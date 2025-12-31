import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon'; // ✅ IMPORTANT si tu utilises <mat-icon>
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  selector: 'app-forgot-password',
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
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  loading = signal(false);
  done = signal(false);
  msg = signal<string | null>(null);

  form = this.fb.group({
    email: this.fb.control('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  async submit() {
    if (this.loading()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const email = this.form.controls.email.value.trim().toLowerCase();
    if (!email) {
      this.form.controls.email.setErrors({ required: true });
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.msg.set(null);

    try {
      await this.auth.forgotPassword(email);
      this.done.set(true);
      this.msg.set('Si un compte existe, un email vient d’être envoyé.');
      // optionnel: tu peux disable le formulaire après succès
      // this.form.disable();
    } catch (e) {
      this.msg.set('Erreur serveur. Réessaie plus tard.');
    } finally {
      this.loading.set(false);
    }
  }
}
