import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

/* Angular Material */
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatIconModule, MatButtonModule, MatCheckboxModule, MatProgressSpinnerModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);

  verificationMessage = signal<string | null>(null);
  resending = signal(false);

  async resendVerification() {
    const email = this.form.controls.email;
    if (email.invalid) { email.markAsTouched(); return; }
    this.resending.set(true);
    try {
      const result = await this.auth.resendVerification(email.value!);
      this.verificationMessage.set(result.message);
    } catch {
      this.verificationMessage.set('Impossible de renvoyer le lien pour le moment. Réessaie plus tard.');
    } finally { this.resending.set(false); }
  }

  hide = signal(true);
  loading = signal(false);
  errorMsg = signal<string | null>(null);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [true],
  });

  emailErr = computed(() => {
    const c = this.form.controls.email;
    if (!c.touched && !c.dirty) return null;
    if (c.hasError('required')) return 'Email requis';
    if (c.hasError('email')) return 'Email invalide';
    return null;
  });

  passwordErr = computed(() => {
    const c = this.form.controls.password;
    if (!c.touched && !c.dirty) return null;
    if (c.hasError('required')) return 'Mot de passe requis';
    if (c.hasError('minlength')) return 'Au moins 6 caractères';
    return null;
  });

  async submit() {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }
  this.loading.set(true);
  this.errorMsg.set(null);

  try {
    const { email, password } = this.form.value;
    if (!email || !password) return;

    const destination = this.route.snapshot.queryParamMap.get('returnUrl');
    if (destination === '/profile?tab=subscription') {
      await this.auth.login(email, password, destination);
    } else {
      await this.auth.login(email, password);
    }

  } catch (e: any) {
    this.errorMsg.set(e?.error?.message ?? 'Échec de la connexion');
  } finally {
    this.loading.set(false);
  }
}

}
