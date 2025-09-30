import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../core/auth.service';
import { UserService, UserMe } from '../../core/user.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatDividerModule,
    MatSnackBarModule, MatProgressSpinnerModule, RouterModule,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  private fb    = inject(FormBuilder);
  private users = inject(UserService);
  private auth  = inject(AuthService);
  private snack = inject(MatSnackBar);

  me!: UserMe;
  form!: FormGroup;
  loading = false;

  // Snapshots pour détecter ce qui a changé
  private orig = { fullName: '', email: '' };

  async ngOnInit() {
    this.me = await this.users.getMe();
    this.form = this.fb.group({
      fullName: [this.me.fullName ?? '', [Validators.required, Validators.maxLength(80)]],
      email:    [this.me.email ?? '', [Validators.required, Validators.email, Validators.maxLength(160)]],
      currentPassword: [''],
      newPassword:     [''], // min len côté back si nécessaire
    });
    this.orig.fullName = this.form.value.fullName;
    this.orig.email    = this.form.value.email;
  }

  get fullNameCtrl() { return this.form.get('fullName')!; }
  get emailCtrl()    { return this.form.get('email')!; }
  get currPwdCtrl()  { return this.form.get('currentPassword')!; }
  get newPwdCtrl()   { return this.form.get('newPassword')!; }

  get hasChanges(): boolean {
    const v = this.form.value as any;
    return (
      v.fullName?.trim() !== this.orig.fullName ||
      v.email?.trim() !== this.orig.email ||
      !!v.newPassword // si un nouveau mot de passe est saisi, on considérera qu'il y a un changement
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
      // 1) Construire un DTO partiel avec uniquement les champs modifiés
      const profileDto: any = {};
      if (v.fullName?.trim() !== this.orig.fullName) profileDto.fullName = v.fullName.trim();
      if (v.email?.trim()    !== this.orig.email)    profileDto.email    = v.email.trim();

      if (Object.keys(profileDto).length) {
        await this.users.updateMe(profileDto);
        this.orig.fullName = profileDto.fullName ?? this.orig.fullName;
        this.orig.email    = profileDto.email    ?? this.orig.email;
      }

      // 2) Mot de passe si renseigné
      if (v.newPassword) {
        await this.users.changePassword({
          currentPassword: v.currentPassword ?? '',
          newPassword: v.newPassword,
        });
        this.currPwdCtrl.setValue('');
        this.newPwdCtrl.setValue('');
      }

      // 3) Feedback + refresh éventuel de la session
      this.snack.open('Modifications enregistrées ✅', 'OK', { duration: 2000 });
      // Optionnel: si tu tiens un cache utilisateur côté AuthService, rafraîchis-le
      // await this.auth.fetchMe();
      this.form.markAsPristine();
    } catch (e: any) {
      this.snack.open(e?.error?.message || 'Échec de l’enregistrement', 'Fermer', { duration: 3500 });
    } finally {
      this.loading = false;
    }
  }

  async deleteAccount() {
    if (!confirm('Cette action est définitive. Supprimer votre compte ?')) return;
    try {
      await this.users.deleteMe();
      this.snack.open('Compte supprimé. Au revoir 👋', 'OK', { duration: 2000 });
      this.auth.logout();
    } catch (e: any) {
      this.snack.open(e?.error?.message || 'Suppression impossible', 'Fermer', { duration: 3000 });
    }
  }
}
