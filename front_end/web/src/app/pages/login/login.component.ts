import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

/* Angular Material */
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/* RxJS */
import { firstValueFrom } from 'rxjs';

/* Service d'auth */
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
  private auth = inject(AuthService);

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

    // Appel AuthService: renvoie une Promise<boolean> (navigation)
    await this.auth.login(email, password);

    // Rien d'autre à faire ici : AuthService s'occupe de setToken, fetchMe et redirection
  } catch (e: any) {
    this.errorMsg.set(e?.error?.message ?? 'Échec de la connexion');
  } finally {
    this.loading.set(false);
  }
}

}
