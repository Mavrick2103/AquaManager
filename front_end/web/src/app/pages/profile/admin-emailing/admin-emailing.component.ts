import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { AdminEmailingService, EmailAudienceFilter, EmailPreview } from '../../../core/admin-emailing.service';
import { AdminUser, AdminUsersApi } from '../../../core/admin-users.service';
import { AdminSidebarComponent } from '../../../shared/admin-sidebar/admin-sidebar.component';

@Component({ selector: 'app-admin-emailing', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule, MatSnackBarModule, AdminSidebarComponent],
  templateUrl: './admin-emailing.component.html', styleUrl: './admin-emailing.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class AdminEmailingComponent implements OnInit {
  private readonly fb = inject(FormBuilder); private readonly api = inject(AdminEmailingService);
  private readonly usersApi = inject(AdminUsersApi); private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(MatSnackBar); private readonly cdr = inject(ChangeDetectorRef);
  users: AdminUser[] = []; preview: EmailPreview | null = null; previewing = false; sending = false;
  confirmationPending = false;
  sendError = '';
  readonly form = this.fb.nonNullable.group({
    audience: ['ALL' as 'ALL'|'INACTIVE'|'NEVER_CONNECTED'|'SINGLE_USER'], consent: ['ANY' as 'ANY'|'OPTED_IN'|'OPTED_OUT'],
    inactiveDays: [30, [Validators.min(1), Validators.max(3650)]], userId: [0],
    subject: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(10000)]], actionUrl: [''], actionLabel: [''],
  });
  ngOnInit(): void {
    this.usersApi.list().subscribe({ next: users => { this.users = users; const id = Number(this.route.snapshot.queryParamMap.get('userId')); if (id > 0) this.form.patchValue({ audience: 'SINGLE_USER', userId: id }); this.cdr.markForCheck(); this.loadPreview(); }, error: () => this.snack.open('Impossible de charger les utilisateurs', 'Fermer', { duration: 3500 }) });
    const invalidatePreview = () => { this.preview = null; this.cdr.markForCheck(); };
    this.form.controls.audience.valueChanges.subscribe(invalidatePreview);
    this.form.controls.consent.valueChanges.subscribe(invalidatePreview);
    this.form.controls.inactiveDays.valueChanges.subscribe(invalidatePreview);
    this.form.controls.userId.valueChanges.subscribe(invalidatePreview);
  }
  loadPreview(): void { const filter = this.filterPayload(); if (!filter) return; this.previewing = true; this.api.preview(filter).pipe(finalize(() => { this.previewing = false; this.cdr.markForCheck(); })).subscribe({ next: p => { this.preview = p; this.cdr.markForCheck(); }, error: e => this.snack.open(e?.error?.message || 'Aperçu impossible', 'Fermer', { duration: 4000 }) }); }
  send(): void {
    if (this.form.invalid || !this.preview?.count || this.sending) { this.form.markAllAsTouched(); return; }
    this.sendError = '';
    this.confirmationPending = true;
    this.cdr.markForCheck();
  }
  cancelSend(): void { this.confirmationPending = false; this.cdr.markForCheck(); }
  confirmSend(): void {
    const filter = this.filterPayload(); if (!filter || !this.preview?.count || this.sending) return;
    const value = this.form.getRawValue();
    this.confirmationPending = false;
    this.sending = true;
    this.api.send({ ...filter, subject: value.subject.trim(), message: value.message.trim(), actionUrl: value.actionUrl.trim() || undefined, actionLabel: value.actionLabel.trim() || undefined }).pipe(finalize(() => { this.sending = false; this.cdr.markForCheck(); })).subscribe({
      next: r => { this.sendError = ''; this.snack.open(`${r.sent} email(s) envoyé(s)${r.failed ? `, ${r.failed} échec(s)` : ''}`, 'OK', { duration: 6000 }); },
      error: e => { this.sendError = e?.error?.message || 'Envoi impossible. Vérifiez que le backend a été redémarré et que SMTP est configuré.'; this.snack.open(this.sendError, 'Fermer', { duration: 6000 }); this.cdr.markForCheck(); },
    });
  }
  private filterPayload(): EmailAudienceFilter | null { const v = this.form.getRawValue(); if (v.audience === 'INACTIVE' && v.inactiveDays < 1) return null; if (v.audience === 'SINGLE_USER' && !v.userId) return null; return { audience: v.audience, consent: v.consent, ...(v.audience === 'INACTIVE' ? { inactiveDays: v.inactiveDays } : {}), ...(v.audience === 'SINGLE_USER' ? { userId: v.userId } : {}) }; }
}
