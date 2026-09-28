import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { InstagramTokenService } from '../../src/marketing/instagram-token.service';

const DAY = 86400000;
describe('Instagram token lifecycle', () => {
  let directory: string;
  let file: string;
  let now: number;
  let network: jest.SpyInstance;
  let service: InstagramTokenService;
  const originalEnv = { ...process.env };
  const response = (data: unknown, ok = true) => ({ ok, json: async () => data }) as Response;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'aquamanager-instagram-test-'));
    file = join(directory, 'token.json');
    process.env.META_INSTAGRAM_AUTO_REFRESH = 'true';
    process.env.META_INSTAGRAM_ACCESS_TOKEN = 'seed-secret';
    process.env.META_INSTAGRAM_TOKEN_FILE = file;
    now = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    network = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('unexpected network'));
    service = new InstagramTokenService();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
    await rm(directory, { recursive: true, force: true });
  });
  const success = () => response({ access_token: 'rotated-secret', expires_in: 60 * DAY / 1000 });
  async function makeDue() {
    await service.accessToken();
    now += 26 * 3600000;
  }

  it('waits at least 24h before the first refresh and survives restart', async () => {
    await service.onApplicationBootstrap();
    now += DAY;
    await new InstagramTokenService().refreshIfDue();
    expect(network).not.toHaveBeenCalled();
  });
  it('persists a rotated token, uses a fixed endpoint and returns only safe health fields', async () => {
    await makeDue();
    network.mockResolvedValue(success());
    await service.refreshIfDue();
    expect(await new InstagramTokenService().accessToken()).toBe('rotated-secret');
    const url = network.mock.calls[0][0] as URL;
    expect(url.origin + url.pathname).toBe('https://graph.instagram.com/refresh_access_token');
    expect(url.searchParams.get('grant_type')).toBe('ig_refresh_token');
    expect(url.searchParams.get('access_token')).toBe('seed-secret');
    const health = await service.health();
    expect(health.expiresAt).toBe(new Date(now + 60 * DAY).toISOString());
    expect(JSON.stringify(health)).not.toContain('secret');
    now += 6 * DAY;
    await service.refreshIfDue();
    expect(network).toHaveBeenCalledTimes(1);
    now += DAY;
    await service.refreshIfDue();
    expect(network).toHaveBeenCalledTimes(2);
  });
  it('keeps the last working token on transient errors and retries the next day', async () => {
    await makeDue();
    network.mockResolvedValue(response({ error: { message: 'seed-secret' } }, false));
    await service.refreshIfDue();
    expect(await service.accessToken()).toBe('seed-secret');
    expect(JSON.stringify(await service.health())).not.toContain('seed-secret');
    await service.refreshIfDue();
    expect(network).toHaveBeenCalledTimes(1);
    now += DAY;
    network.mockResolvedValue(success());
    await service.refreshIfDue();
    expect((await service.health()).renewalWarning).toBeNull();
  });
  it('stops retrying a revoked token and reports reconnection', async () => {
    await makeDue();
    network.mockResolvedValue(response({ error: { code: 190 } }, false));
    await service.refreshIfDue();
    now += 2 * DAY;
    await new InstagramTokenService().refreshIfDue();
    expect(network).toHaveBeenCalledTimes(1);
    expect((await service.health()).reconnectRequired).toBe(true);
  });
  it('detects expiry after a long server outage without sending the expired credential', async () => {
    await makeDue();
    network.mockResolvedValue(success());
    await service.refreshIfDue();
    now += 61 * DAY;
    const restarted = new InstagramTokenService();
    await restarted.refreshIfDue();
    expect((await restarted.health()).reconnectRequired).toBe(true);
    expect(network).toHaveBeenCalledTimes(1);
  });
  it.each([
    { access_token: '', expires_in: 5184000 },
    { access_token: 'bad', expires_in: 3600 },
    { access_token: 'bad', expires_in: '5184000' },
  ])('does not replace the credential with an invalid response: %j', async (data) => {
    await makeDue();
    network.mockResolvedValue(response(data));
    await service.refreshIfDue();
    expect(await new InstagramTokenService().accessToken()).toBe('seed-secret');
  });
  it('adopts an explicitly replaced env token instead of the old saved token', async () => {
    await makeDue();
    network.mockResolvedValue(success());
    await service.refreshIfDue();
    process.env.META_INSTAGRAM_ACCESS_TOKEN = 'new-manual-secret';
    const replacement = new InstagramTokenService();
    expect(await replacement.accessToken()).toBe('new-manual-secret');
    expect((await replacement.health()).lastRefreshedAt).toBeNull();
  });
  it('fails closed on corrupt storage rather than reverting silently to an old env token', async () => {
    await writeFile(file, '{broken');
    await expect(service.accessToken()).rejects.toThrow('stockage');
    await service.refreshIfDue();
    expect(network).not.toHaveBeenCalled();
    expect((await service.health()).renewalWarning).toBeTruthy();
  });
  it('does nothing when disabled', async () => {
    process.env.META_INSTAGRAM_AUTO_REFRESH = 'false';
    const disabled = new InstagramTokenService();
    await disabled.refreshIfDue();
    expect(await disabled.accessToken()).toBe('seed-secret');
    await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(network).not.toHaveBeenCalled();
  });
  it('prevents overlapping refreshes in the single API process', async () => {
    await makeDue();
    network.mockResolvedValue(success());
    await Promise.all([service.refreshIfDue(), service.refreshIfDue(), service.refreshIfDue()]);
    expect(network).toHaveBeenCalledTimes(1);
  });
});
