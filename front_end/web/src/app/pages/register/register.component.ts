import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth.service';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pwd = group.get('password')?.value;
  const cfm = group.get('confirmPassword')?.value;
  return pwd && cfm && pwd !== cfm ? { passwordsMismatch: true } : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private snack = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);

  hidePwd = signal(true);
  hideCfm = signal(true);
  loading = signal(false);
  errorMsg = signal<string | null>(null);

  form = this.fb.group({
    fullName: this.fb.control('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    email: this.fb.control('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    passwords: this.fb.group(
      {
        password: this.fb.control('', {
          nonNullable: true,
          validators: [
            Validators.required,
            Validators.minLength(8),
            // maj, min, chiffre, caractère spécial
            Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/),
          ],
        }),
        confirmPassword: this.fb.control('', {
          nonNullable: true,
          validators: [Validators.required],
        }),
      },
      { validators: passwordsMatch }
    ),
    acceptTos: this.fb.control(false, {
      nonNullable: true,
      validators: [Validators.requiredTrue],
    }),
  });

  get fullName() {
    return this.form.controls.fullName;
  }
  get email() {
    return this.form.controls.email;
  }
  get passwords() {
    return this.form.controls.passwords;
  }
  get password() {
    return this.passwords.get('password');
  }
  get confirmPassword() {
    return this.passwords.get('confirmPassword');
  }
  get acceptTos() {
    return this.form.controls.acceptTos;
  }

  // signal qui suit la valeur du mot de passe
  passwordValue = signal('');

  constructor() {
    const pwdCtrl = this.password;
    if (pwdCtrl) {
      pwdCtrl.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((v) => this.passwordValue.set(v ?? ''));
    }
  }

  strength = computed(() => {
    const v = this.passwordValue();
    let s = 0;
    if (v.length >= 8) s++;
    if (/[A-Z]/.test(v)) s++;
    if (/[a-z]/.test(v)) s++;
    if (/\d/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    return Math.min(s, 5);
  });

  strengthLabel = computed(() => {
    const x = this.strength();
    return ['Très faible', 'Faible', 'Moyenne', 'Bonne', 'Forte'][Math.max(0, x - 1)] ?? 'Très faible';
  });

  async submit() {
    if (this.loading()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMsg.set('Formulaire incomplet ou invalide');
      return;
    }

    this.loading.set(true);
    this.errorMsg.set(null);

    try {
      const payload = {
        fullName: this.fullName.value,
        email: this.email.value,
        password: String(this.password?.value ?? ''),
      };

      await this.authService.register(payload);

      // ✅ Message succès
      this.snack.open(
        'Compte créé ✅ Vérifie ton e-mail pour activer ton compte.',
        'OK',
        { duration: 4500 }
      );

      // ✅ Redirection correcte
      await this.router.navigateByUrl('/login');
    } catch (e: any) {
      this.errorMsg.set(
        e?.error?.message ?? e?.message ?? 'Échec de la création de compte'
      );
    } finally {
      this.loading.set(false);
    }
  }
}
