import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

type CheckoutRes = { url: string };
type PortalRes = { url: string };

@Injectable({ providedIn: 'root' })
export class BillingService {
  constructor(private http: HttpClient) {}

  async createPremiumCheckout(): Promise<string> {
    const endpoint = `${environment.apiUrl}/billing/checkout`; // apiUrl = .../api
    const res = await firstValueFrom(this.http.post<CheckoutRes>(endpoint, {}));
    if (!res?.url) throw new Error('Stripe checkout url missing');
    return res.url;
  }

  async openCustomerPortal(): Promise<string> {
    const endpoint = `${environment.apiUrl}/billing/portal`; // GET /api/billing/portal
    const res = await firstValueFrom(this.http.get<PortalRes>(endpoint));
    if (!res?.url) throw new Error('Stripe portal url missing');
    return res.url;
  }

  async cancelSubscription(atPeriodEnd = true): Promise<void> {
    // optionnel : seulement si tu gardes le endpoint /billing/cancel
    const endpoint = `${environment.apiUrl}/billing/cancel?atPeriodEnd=${atPeriodEnd ? 'true' : 'false'}`;
    await firstValueFrom(this.http.post(endpoint, {}));
  }
}