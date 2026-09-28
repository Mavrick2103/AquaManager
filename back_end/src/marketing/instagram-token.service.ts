import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
interface TokenState {
  seedHash: string;
  token: string;
  nextAttemptAt: number;
  expiresAt: number | null;
  lastRefreshedAt: number | null;
  reconnectRequired: boolean;
  warning: string | null;
}

/** One API instance owns the private persistent token volume. Never return its contents. */
@Injectable()
export class InstagramTokenService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InstagramTokenService.name);
  private readonly enabled = process.env.META_INSTAGRAM_AUTO_REFRESH === 'true';
  private readonly seed = process.env.META_INSTAGRAM_ACCESS_TOKEN?.trim() || '';
  private readonly file = resolve(process.env.META_INSTAGRAM_TOKEN_FILE || '.private/instagram-token.json');
  private loading?: Promise<TokenState | null>;
  private busy = false;
  private storageWarning: string | null = null;

  async onApplicationBootstrap() {
    await this.refreshIfDue();
  }

  private async persist(state: TokenState) {
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
    await rename(temporary, this.file);
  }

  private load(): Promise<TokenState | null> {
    if (!this.enabled || !this.seed) return Promise.resolve(null);
    if (!this.loading) {
      this.loading = this.readState().catch(() => {
        this.loading = undefined;
        this.storageWarning = 'Renouvellement Instagram indisponible : stockage privé inaccessible ou invalide.';
        throw new Error(this.storageWarning);
      });
    }
    return this.loading;
  }

  private async readState(): Promise<TokenState> {
    const seedHash = createHash('sha256').update(this.seed).digest('hex');
    let saved: TokenState | undefined;
    try {
      saved = JSON.parse(await readFile(this.file, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (saved?.seedHash === seedHash) {
      if (typeof saved.token !== 'string' || !saved.token || !Number.isFinite(saved.nextAttemptAt)
        || typeof saved.reconnectRequired !== 'boolean'
        || !(saved.expiresAt === null || Number.isFinite(saved.expiresAt))) {
        throw new Error('Invalid private state');
      }
      this.storageWarning = null;
      return saved;
    }
    // A replacement in .env deliberately supersedes the saved token.
    // The token must be at least 24 hours old before its first refresh.
    const state: TokenState = {
      seedHash, token: this.seed, nextAttemptAt: Date.now() + 25 * HOUR,
      expiresAt: null, lastRefreshedAt: null, reconnectRequired: false, warning: null,
    };
    await this.persist(state);
    this.storageWarning = null;
    return state;
  }

  async accessToken(): Promise<string> {
    const state = await this.load();
    return state?.token || this.seed;
  }

  async health() {
    let state: TokenState | null = null;
    try { state = await this.load(); } catch { /* Expose only a safe diagnostic. */ }
    return {
      automaticRenewal: this.enabled,
      renewalWarning: this.storageWarning || state?.warning || null,
      reconnectRequired: state?.reconnectRequired || false,
      expiresAt: state?.expiresAt ? new Date(state.expiresAt).toISOString() : null,
      lastRefreshedAt: state?.lastRefreshedAt ? new Date(state.lastRefreshedAt).toISOString() : null,
    };
  }

  @Cron('0 20 4 * * *', { timeZone: 'UTC' })
  async refreshIfDue(): Promise<void> {
    if (!this.enabled || !this.seed || this.busy) return;
    this.busy = true;
    try {
      const state = await this.load();
      if (state && this.storageWarning) {
        await this.persist(state);
        this.storageWarning = null;
      }
      if (!state || state.reconnectRequired || Date.now() < state.nextAttemptAt) return;
      if (state.expiresAt !== null && Date.now() >= state.expiresAt) {
        state.reconnectRequired = true;
        state.warning = 'Connexion Instagram expirée : reconnectez le compte avec un nouveau jeton longue durée.';
        await this.persist(state);
        this.logger.warn(state.warning);
        return;
      }
      try {
        const url = new URL('https://graph.instagram.com/refresh_access_token');
        url.searchParams.set('grant_type', 'ig_refresh_token');
        url.searchParams.set('access_token', state.token);
        const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
        const data = await response.json();
        if (!response.ok) {
          state.reconnectRequired = data?.error?.code === 190;
          throw new Error('Provider rejected refresh');
        }
        if (typeof data.access_token !== 'string' || !data.access_token.trim()
          || typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in)
          || data.expires_in < 2 * DAY / 1000) {
          throw new Error('Invalid refresh response');
        }
        const now = Date.now();
        // Update memory before persistence so a disk failure never reverts a rotated token.
        state.token = data.access_token.trim();
        state.expiresAt = now + data.expires_in * 1000;
        state.lastRefreshedAt = now;
        state.nextAttemptAt = now + Math.min(7 * DAY, data.expires_in * 500);
        state.warning = null;
      } catch {
        state.nextAttemptAt = Date.now() + DAY;
        state.warning = state.reconnectRequired
          ? 'Accès Instagram expiré ou révoqué : reconnectez le compte avec un nouveau jeton longue durée.'
          : 'Renouvellement Instagram en échec. Nouvelle tentative automatique sous 24 heures ; vérifiez la connexion si le problème persiste.';
        this.logger.warn(state.warning);
      }
      await this.persist(state);
      this.storageWarning = null;
    } catch {
      this.storageWarning = 'Le renouvellement Instagram ne peut pas être sauvegardé. Vérifiez le stockage privé du serveur.';
      this.logger.error(this.storageWarning);
    } finally {
      this.busy = false;
    }
  }
}
