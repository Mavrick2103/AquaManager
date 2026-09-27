import { BadGatewayException, BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaypalApiService {
  private token?: { value: string; expires: number };
  constructor(private readonly config: ConfigService) {}

  get environment(): 'sandbox' | 'live' {
    const value = this.config.get<string>('PAYPAL_ENV', 'sandbox');
    if (value !== 'sandbox' && value !== 'live') throw new ServiceUnavailableException('Environnement PayPal invalide.');
    return value;
  }
  get enabled(): boolean { return this.config.get<string>('PAYPAL_ENABLED') === 'true'; }
  get planId(): string { return this.config.get<string>('PAYPAL_PLAN_PREMIUM', '').trim(); }
  get ready(): boolean {
    return this.enabled && this.configured && !!this.planId && !!this.config.get('PAYPAL_WEBHOOK_ID');
  }
  get configured(): boolean { return !!this.config.get('PAYPAL_CLIENT_ID') && !!this.config.get('PAYPAL_CLIENT_SECRET'); }
  get baseUrl(): string {
    return this.environment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  }
  get appUrl(): string {
    const url = new URL(this.config.get<string>('APP_URL', 'http://localhost:4200'));
    if (this.environment === 'live' && url.protocol !== 'https:') throw new ServiceUnavailableException('APP_URL doit utiliser HTTPS en production.');
    return url.origin;
  }
  approvalUrl(value: string): string {
    const url = new URL(value);
    const host = this.environment === 'live' ? 'www.paypal.com' : 'www.sandbox.paypal.com';
    if (url.protocol !== 'https:' || url.hostname !== host || url.username || url.password || url.port) {
      throw new BadGatewayException('Adresse de paiement PayPal invalide.');
    }
    return url.href;
  }
  requireReady(): void {
    if (!this.ready) throw new ServiceUnavailableException('Le paiement PayPal n’est pas encore disponible.');
  }
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expires > Date.now()) return this.token.value;
    const id = this.config.get<string>('PAYPAL_CLIENT_ID');
    const secret = this.config.get<string>('PAYPAL_CLIENT_SECRET');
    if (!id || !secret) throw new ServiceUnavailableException('PayPal non configuré.');
    const data = await this.fetchJson('/v1/oauth2/token', {
      method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials',
    });
    if (!data.access_token) throw new BadGatewayException('Authentification PayPal impossible.');
    this.token = { value: data.access_token, expires: Date.now() + Math.max(0, Number(data.expires_in) - 60) * 1000 };
    return this.token.value;
  }
  async request(path: string, method = 'GET', body?: unknown, requestId?: string): Promise<any> {
    const token = await this.accessToken();
    return this.fetchJson(path, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
        Prefer: 'return=representation', ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }
  private async fetchJson(path: string, init: RequestInit): Promise<any> {
    if (!path.startsWith('/v1/') || path.includes('://')) throw new BadRequestException('Chemin PayPal invalide.');
    try {
      const res = await fetch(`${this.baseUrl}${path}`, { ...init, redirect: 'error', signal: AbortSignal.timeout(15_000) });
      if (!res.ok) {
        if (res.status === 401) this.token = undefined;
        // Never include response bodies, tokens or credentials in errors/logs.
        throw new BadGatewayException(`PayPal temporairement indisponible (HTTP ${res.status}).`);
      }
      return res.status === 204 ? {} : await res.json();
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('Impossible de joindre PayPal. Réessaie dans quelques instants.');
    }
  }
  async verifyWebhook(headers: Record<string, any>, event: any): Promise<void> {
    const webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID');
    if (!webhookId) throw new ServiceUnavailableException('Webhook PayPal non configuré.');
    const fields = ['paypal-transmission-id', 'paypal-transmission-time', 'paypal-transmission-sig', 'paypal-cert-url', 'paypal-auth-algo'];
    if (fields.some((key) => typeof headers[key] !== 'string' || !headers[key])) throw new UnauthorizedException('Signature PayPal manquante.');
    const result = await this.request('/v1/notifications/verify-webhook-signature', 'POST', {
      transmission_id: headers['paypal-transmission-id'], transmission_time: headers['paypal-transmission-time'],
      transmission_sig: headers['paypal-transmission-sig'], cert_url: headers['paypal-cert-url'],
      auth_algo: headers['paypal-auth-algo'], webhook_id: webhookId, webhook_event: event,
    });
    if (result.verification_status !== 'SUCCESS') throw new UnauthorizedException('Signature PayPal invalide.');
  }
}
