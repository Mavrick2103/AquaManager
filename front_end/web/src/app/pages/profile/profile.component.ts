import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { firstValueFrom } from 'rxjs';
import { UserService } from '../../core/user.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,   // ✅ RouterLink
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSnackBarModule, MatDividerModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private user = inject(UserService);
  private snack = inject(MatSnackBar);

  loading = true;
  saving = false;

  infoForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(60)]],
    lastName:  ['', [Validators.required, Validators.maxLength(60)]],
    email:     ['', [Validators.required, Validators.email]],
  });

  pwdForm = this.fb.group({
    currentPassword: ['', [Validators.required, Validators.minLength(6)]],
    newPassword:     ['', [Validators.required, Validators.minLength(8)]],
  });

  async ngOnInit() {
    try {
      const me = await firstValueFrom(this.user.me());
      this.infoForm.patchValue(me as any);
    } catch {
      this.snack.open('Impossible de charger le profil', 'Fermer', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  async saveInfo() {
    if (this.infoForm.invalid) return;
    this.saving = true;
    try {
      const dto = { ...this.infoForm.getRawValue() } as any;
      await firstValueFrom(this.user.updateMe(dto));
      this.infoForm.markAsPristine();
      this.snack.open('Profil mis à jour', 'OK', { duration: 2000 });
    } catch {
      this.snack.open('Échec de la mise à jour', 'Fermer', { duration: 3000 });
    } finally {
      this.saving = false;
    }
  }

  async changePassword() {
    if (this.pwdForm.invalid) return;
    this.saving = true;
    try {
      await firstValueFrom(this.user.changePassword(this.pwdForm.getRawValue() as any));
      this.pwdForm.reset();
      this.snack.open('Mot de passe modifié', 'OK', { duration: 2000 });
    } catch {
      this.snack.open('Échec de la modification du mot de passe', 'Fermer', { duration: 3000 });
    } finally {
      this.saving = false;
    }
  }
}
