import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
import { BillingService, PaypalBillingStatus } from '../../core/billing.service';
import { SettingsService, UserSettings } from '../../core/settings.service';

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
export class ProfileComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private users = inject(UserService);
  private auth = inject(AuthService);
  private billing = inject(BillingService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  selectedTabIndex = this.route.snapshot.queryParamMap.get('tab') === 'subscription' ? 1 : 0;
  paypalState: PaypalBillingStatus | null = null;
  private paymentCheckTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  ngOnDestroy(): void {
    this.destroyed = true;
    clearTimeout(this.paymentCheckTimer);
  }

  private watchPaymentConfirmation(remaining = 20): void {
    clearTimeout(this.paymentCheckTimer);
    if (this.destroyed || remaining <= 0 || this.paypalState?.provider !== 'paypal'
        || this.paypalState.premium || !['CREATING', 'APPROVAL_PENDING', 'APPROVED', 'ACTIVE'].includes(this.paypalState.status ?? '')) return;
    this.paymentCheckTimer = setTimeout(async () => {
      if (this.destroyed) return;
      if (!this.billingLoading) {
        try {
          const state = await this.billing.refreshPaypal();
          if (this.destroyed) return;
          this.paypalState = state;
          await this.reloadMe();
          if (this.destroyed) return;
          if (state.premium) this.showPaymentNotice('Paiement confirmé : ton accès Premium est actif.');
        } catch {
          // A temporary provider error is retried without repeated popups.
        }
      }
      this.watchPaymentConfirmation(remaining - 1);
    }, 15000);
  }
  private settingsApi = inject(SettingsService);
  private snack = inject(MatSnackBar);
  private title = inject(Title);
  private meta = inject(Meta);

  me!: ExtendedMe;

  form!: FormGroup;
  loading = false;
  billingLoading = false;
  notificationsLoading = false;

  notificationSettings: Pick<
    UserSettings,
    'notificationsEnabled' | 'emailNotifications' | 'pushNotifications' |
    'taskReminders' | 'automaticNotifications' | 'newsAndUpdates'
  > = {
    notificationsEnabled: false,
    emailNotifications: true,
    pushNotifications: false,
    taskReminders: true,
    automaticNotifications: true,
    newsAndUpdates: false,
  };

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
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
      currentPassword: [''],
      newPassword: ['', [Validators.minLength(8), Validators.pattern(/^(?=.*[!@#$%^&*(),.?":{}|<>_\-=/+]).+$/)]],
    });

    await this.reloadMe();
    const paypalReturn = this.route.snapshot.queryParamMap.get('paypal');
    try {
      this.paypalState = await this.billing.paypalStatus();
      if (paypalReturn === 'return') {
        this.paypalState = await this.billing.refreshPaypal();
        await this.reloadMe();
        this.showPaymentNotice(this.paypalState.premium
          ? 'Paiement confirmé : ton accès Premium est actif.'
          : 'PayPal confirme ton paiement. La vérification se poursuit automatiquement ; inutile de payer à nouveau.');
      } else if (paypalReturn === 'cancel') {
        this.showPaymentNotice('Paiement interrompu. Tu peux reprendre la souscription depuis ton profil.');
      }
    } catch {
      this.showPaymentNotice('Le statut du paiement est temporairement indisponible. Réessaie dans quelques instants.');
    } finally {
      if (paypalReturn) {
        // Consume the return once so refreshing the profile does not replay the notification.
        await this.router.navigate([], { relativeTo: this.route, replaceUrl: true,
          queryParamsHandling: 'merge', queryParams: { paypal: null, subscription_id: null, ba_token: null, token: null } });
      }
    }
    this.watchPaymentConfirmation();
    await this.loadNotificationSettings();

    const raw = localStorage.getItem('aquamanager:prefs');
    if (raw) {
      try {
        this.prefs = { ...this.prefs, ...JSON.parse(raw) };
      } catch {
        // ignore
      }
    }
  }

  private async loadNotificationSettings(): Promise<void> {
    try {
      const settings = await this.settingsApi.getMySettings();
      if (!settings) return;
      this.notificationSettings = {
        notificationsEnabled: settings.notificationsEnabled,
        emailNotifications: settings.notificationsEnabled,
        pushNotifications: false,
        taskReminders: settings.taskReminders,
        automaticNotifications: settings.automaticNotifications,
        newsAndUpdates: settings.newsAndUpdates,
      };
    } catch {
      this.snack.open('Impossible de charger les préférences de notifications', 'Fermer', { duration: 3000 });
    }
  }

  async saveNotificationSettings(): Promise<void> {
    if (this.notificationsLoading) return;
    this.notificationsLoading = true;
    try {
      if (this.notificationSettings.notificationsEnabled) {
        this.notificationSettings.emailNotifications = true;
      }
      const saved = await this.settingsApi.updateMySettings({
        ...this.notificationSettings,
        pushNotifications: false,
      });
      this.notificationSettings = {
        notificationsEnabled: saved.notificationsEnabled,
        emailNotifications: saved.emailNotifications,
        pushNotifications: false,
        taskReminders: saved.taskReminders,
        automaticNotifications: saved.automaticNotifications,
        newsAndUpdates: saved.newsAndUpdates,
      };
      this.snack.open(
        saved.notificationsEnabled ? 'Préférences de notifications enregistrées' : 'Notifications désactivées',
        'OK',
        { duration: 2200 },
      );
    } catch (e: any) {
      this.snack.open(e?.error?.message || 'Impossible d’enregistrer les préférences', 'Fermer', { duration: 3200 });
    } finally {
      this.notificationsLoading = false;
    }
  }

  onNotificationConsentChange(enabled: boolean): void {
    this.notificationSettings.notificationsEnabled = enabled;
    this.notificationSettings.emailNotifications = enabled;
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
    if (this.me?.subscriptionEndsAt && new Date(this.me.subscriptionEndsAt).getTime() <= Date.now()) return false;
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
      if (profileDto.email && v.newPassword) {
        this.snack.open('Modifie ton e-mail et ton mot de passe séparément.', 'OK', { duration: 5000 });
        return;
      }
      if (profileDto.email) profileDto.currentPassword = v.currentPassword || undefined;

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
        await this.auth.logout();
        this.snack.open('Mot de passe modifié. Reconnecte-toi avec le nouveau mot de passe.', 'OK', { duration: 6000 });
        return;
      }

      this.emailCtrl.setValue(this.orig.email);
      this.snack.open(profileDto.email ? 'Un lien de confirmation a été envoyé à la nouvelle adresse. Ton adresse actuelle reste active.' : 'Modifications enregistrées ✅', 'OK', { duration: 6000 });
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
    if (this.billingLoading) return;
    this.billingLoading = true;
    try {
      const url = await this.billing.createPremiumCheckout();
      window.location.href = url;
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
      if (this.paypalState?.provider === 'paypal') {
        this.paypalState = await this.billing.cancelPaypal();
      } else {
        await this.billing.cancelSubscription(true);
      }
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
  async refreshPayment() {
    if (this.billingLoading) return;
    this.billingLoading = true;
    try {
      this.paypalState = await this.billing.refreshPaypal();
      await this.reloadMe();
      this.showPaymentNotice(this.paypalState.premium
        ? 'Ton accès Premium est actif.' : 'Paiement non confirmé pour le moment. Si tu viens de payer, réessaie dans quelques instants.');
    } catch (e: any) {
      this.showPaymentNotice(e?.error?.message || 'Impossible de vérifier le paiement pour le moment.');
    } finally { this.billingLoading = false; }
  }
  // -------------------------
  private showPaymentNotice(message: string): void {
    this.snack.open(message, 'Fermer', { duration: 6000, horizontalPosition: 'center', verticalPosition: 'top' });
  }

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
