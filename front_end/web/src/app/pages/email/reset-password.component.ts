import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../core/auth.service';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pwd = group.get('newPassword')?.value;
  const cfm = group.get('confirmPassword')?.value;
  return pwd && cfm && pwd !== cfm ? { passwordsMismatch: true } : null;
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,

    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  loading = signal(false);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  hidePwd = signal(true);
  hideCfm = signal(true);

  token = '';

  form = this.fb.group({
    passwords: this.fb.group(
      {
        newPassword: this.fb.control('', {
          nonNullable: true,
          validators: [
            Validators.required,
            Validators.minLength(8),
            Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/),
          ],
        }),
        confirmPassword: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
      },
      { validators: passwordsMatch },
    ),
  });

  get passwords() { return this.form.controls.passwords; }
  get newPassword() { return this.passwords.get('newPassword'); }
  get confirmPassword() { return this.passwords.get('confirmPassword'); }

  constructor() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) this.errorMsg.set('Lien invalide (token manquant).');
  }

  async submit() {
    if (this.loading()) return;

    this.errorMsg.set(null);
    this.successMsg.set(null);

    if (!this.token) {
      this.errorMsg.set('Lien invalide (token manquant).');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMsg.set('Mot de passe invalide.');
      return;
    }

    this.loading.set(true);
    try {
      const newPassword = String(this.newPassword?.value ?? '');

      await this.auth.resetPassword(this.token, newPassword);

      this.successMsg.set('Mot de passe mis à jour. Redirection vers la connexion…');
      setTimeout(() => this.router.navigateByUrl('/login'), 900);
    } catch (e: any) {
      this.errorMsg.set(e?.error?.message ?? 'Erreur serveur. Réessaie plus tard.');
    } finally {
      this.loading.set(false);
    }
  }
}
