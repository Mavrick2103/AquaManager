import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { AuthService } from '../../core/auth.service';
import { UserService, UserMe } from '../../core/user.service';
import { BillingService } from '../../core/billing.service';

type AppRole = 'USER' | 'EDITOR' | 'ADMIN' | 'SUPERADMIN';
type SubStatus = 'none' | 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete';
type Plan = 'CLASSIC' | 'PREMIUM' | 'PRO';

type ExtendedMe = UserMe & {
  role?: string;
  subscriptionPlan?: Plan;
  subscriptionStatus?: SubStatus;
  subscriptionEndsAt?: string | Date | null;
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,

    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatButtonToggleModule,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private users = inject(UserService);
  private auth = inject(AuthService);
  private billing = inject(BillingService);
  private snack = inject(MatSnackBar);
  private title = inject(Title);
  private meta = inject(Meta);

  me!: ExtendedMe;

  form!: FormGroup;
  loading = false;
  billingLoading = false;

  prefs = {
    theme: 'system' as 'system' | 'light' | 'dark',
    tempUnit: 'C' as 'C' | 'F',
    notifyTasks: true,
  };

  private orig = { fullName: '', email: '' };
  get isSubscribedActive(): boolean {
  return this.isPremium;
}

  async ngOnInit() {
    this.title.setTitle('Paramètres & Profil • AquaManager');
    this.meta.updateTag({
      name: 'description',
      content:
        'Gérez votre profil, vos préférences d’affichage, notifications et exportez vos données sur AquaManager.',
    });

    this.form = this.fb.group({
      fullName: ['', [Validators.required, Validators.maxLength(80)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
      currentPassword: [''],
      newPassword: [''],
    });

    await this.reloadMe();

    const raw = localStorage.getItem('aquamanager:prefs');
    if (raw) {
      try {
        this.prefs = { ...this.prefs, ...JSON.parse(raw) };
      } catch {
        // ignore
      }
    }
  }

  private async reloadMe() {
    this.me = (await this.users.getMe()) as ExtendedMe;

    const rawFullName = String(this.me.fullName ?? '').trim();
    const fullName =
      rawFullName.length > 0 ? rawFullName : String(this.me.email ?? '').split('@')[0] ?? '';

    this.form.patchValue({
      fullName,
      email: this.me.email ?? '',
    });

    this.orig.fullName = fullName;
    this.orig.email = this.me.email ?? '';
  }

  // -------------------------
  // Role
  // -------------------------
  private get role(): AppRole {
    const r = String(this.me?.role ?? '').toUpperCase();
    if (r === 'ADMIN' || r === 'SUPERADMIN' || r === 'EDITOR' || r === 'USER') return r as AppRole;
    return 'USER';
  }

  get isAdmin(): boolean {
    return this.role === 'ADMIN' || this.role === 'SUPERADMIN';
  }

  get isEditorOnly(): boolean {
    return this.role === 'EDITOR';
  }

  get isEditor(): boolean {
    return this.isAdmin || this.role === 'EDITOR';
  }

  // -------------------------
  // Subscription UI helpers
  // -------------------------
  get plan(): Plan {
    const p = String(this.me?.subscriptionPlan ?? 'CLASSIC').toUpperCase();
    if (p === 'PRO' || p === 'PREMIUM' || p === 'CLASSIC') return p as Plan;
    return 'CLASSIC';
  }

  get subStatus(): SubStatus {
    const s = String(this.me?.subscriptionStatus ?? 'none').toLowerCase();
    if (
      s === 'active' ||
      s === 'trialing' ||
      s === 'canceled' ||
      s === 'past_due' ||
      s === 'incomplete'
    ) {
      return s as SubStatus;
    }
    return 'none';
  }

  get isPremium(): boolean {
    // premium seulement si plan Premium/Pro ET status active/trialing
    if (this.plan !== 'PREMIUM' && this.plan !== 'PRO') return false;
    return this.subStatus === 'active' || this.subStatus === 'trialing';
  }

  get showUpgradeButton(): boolean {
    // "Passer Premium" uniquement si pas premium actif
    return !this.isPremium;
  }

  get endsAtLabel(): string {
    const v = this.me?.subscriptionEndsAt ?? null;
    if (!v) return '—';
    const d = typeof v === 'string' ? new Date(v) : v;
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
  }

  get subscriptionLabel(): string {
    if (!this.isPremium) return 'Classic';
    if (this.subStatus === 'trialing') return 'Premium (essai)';
    return this.plan === 'PRO' ? 'Pro' : 'Premium';
  }

  // -------------------------
  // Form helpers
  // -------------------------
  get fullNameCtrl() {
    return this.form.get('fullName')!;
  }
  get emailCtrl() {
    return this.form.get('email')!;
  }
  get currPwdCtrl() {
    return this.form.get('currentPassword')!;
  }
  get newPwdCtrl() {
    return this.form.get('newPassword')!;
  }

  get hasChanges(): boolean {
    const v = this.form.value as any;
    return (
      v.fullName?.trim() !== this.orig.fullName ||
      v.email?.trim() !== this.orig.email ||
      !!v.newPassword
    );
  }

  reset() {
    this.fullNameCtrl.setValue(this.orig.fullName);
    this.emailCtrl.setValue(this.orig.email);
    this.currPwdCtrl.setValue('');
    this.newPwdCtrl.setValue('');
    this.form.markAsPristine();
  }

  async saveAll() {
    if (this.form.invalid || !this.hasChanges) return;

    this.loading = true;
    const v = this.form.value as any;

    try {
      const profileDto: any = {};
      if (v.fullName?.trim() !== this.orig.fullName) profileDto.fullName = v.fullName.trim();
      if (v.email?.trim() !== this.orig.email) profileDto.email = v.email.trim();

      if (Object.keys(profileDto).length) {
        const updated = await this.users.updateMe(profileDto);
        this.me = { ...this.me, ...updated } as ExtendedMe;
        this.orig.fullName = (updated as any).fullName ?? this.orig.fullName;
        this.orig.email = (updated as any).email ?? this.orig.email;
      }

      if (v.newPassword) {
        await this.users.changePassword({
          currentPassword: v.currentPassword ?? '',
          newPassword: v.newPassword,
        });
        this.currPwdCtrl.setValue('');
        this.newPwdCtrl.setValue('');
      }

      this.snack.open('Modifications enregistrées ✅', 'OK', { duration: 1800 });
      this.form.markAsPristine();
    } catch (e: any) {
      this.snack.open(e?.error?.message || 'Échec de l’enregistrement', 'Fermer', {
        duration: 3200,
      });
    } finally {
      this.loading = false;
    }
  }

  // -------------------------
  // Billing actions
  // -------------------------
  async goPremium() {
    this.billingLoading = true;
    try {
      const url = await this.billing.createPremiumCheckout();
      window.location.href = url; // Stripe Checkout
    } catch (e: any) {
      this.snack.open(e?.error?.message || 'Impossible d’ouvrir le paiement', 'Fermer', {
        duration: 3000,
      });
    } finally {
      this.billingLoading = false;
    }
  }

  async manageSubscription() {
    this.billingLoading = true;
    try {
      // nécessite BillingService.openCustomerPortal()
      const url = await this.billing.openCustomerPortal();
      window.location.href = url; // Stripe Customer Portal (résiliation dedans)
    } catch (e: any) {
      this.snack.open(e?.error?.message || 'Impossible d’ouvrir la gestion abonnement', 'Fermer', {
        duration: 3000,
      });
    } finally {
      this.billingLoading = false;
    }
  }

  // ⚠️ Optionnel : uniquement si tu as vraiment implémenté un endpoint cancel côté API
  // Sinon, garde la résiliation dans le portal (recommandé).
  async cancelSubscription() {
    if (!confirm('Confirmer la résiliation ? (fin de période)')) return;

    this.billingLoading = true;
    try {
      // nécessite BillingService.cancelSubscription(cancelAtPeriodEnd: boolean)
      await this.billing.cancelSubscription(true);
      this.snack.open('Résiliation demandée ✅', 'OK', { duration: 2000 });
      await this.reloadMe();
    } catch (e: any) {
      this.snack.open(e?.error?.message || 'Impossible de résilier', 'Fermer', {
        duration: 3000,
      });
    } finally {
      this.billingLoading = false;
    }
  }

  // -------------------------
  // Account actions
  // -------------------------
  async deleteAccount() {
    if (!confirm('Cette action est définitive. Supprimer votre compte ?')) return;
    try {
      await this.users.deleteMe();
      this.snack.open('Compte supprimé. Au revoir 👋', 'OK', { duration: 1800 });
      this.auth.logout();
    } catch (e: any) {
      this.snack.open(e?.error?.message || 'Suppression impossible', 'Fermer', {
        duration: 3000,
      });
    }
  }

  savePreferences() {
    localStorage.setItem('aquamanager:prefs', JSON.stringify(this.prefs));
    this.snack.open('Préférences enregistrées', 'OK', { duration: 1400 });
  }

  exportData() {
    const fakeDump = {
      user: this.me,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(fakeDump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aquamanager_export.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  logout() {
    this.auth.logout();
    this.snack.open('Déconnecté ✅', 'OK', { duration: 1400 });
  }
}