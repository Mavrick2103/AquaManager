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

type AppRole = 'USER' | 'EDITOR' | 'ADMIN' | 'SUPERADMIN';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, RouterModule,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatDividerModule,
    MatSnackBarModule, MatProgressSpinnerModule,
    MatTabsModule, MatSlideToggleModule, MatSelectModule, MatButtonToggleModule,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  private fb    = inject(FormBuilder);
  private users = inject(UserService);
  private auth  = inject(AuthService);
  private snack = inject(MatSnackBar);
  private title = inject(Title);
  private meta  = inject(Meta);

  me!: UserMe & { role?: string };
  form!: FormGroup;
  loading = false;

  prefs = {
    theme: 'system' as 'system' | 'light' | 'dark',
    tempUnit: 'C' as 'C' | 'F',
    notifyTasks: true,
  };

  private orig = { fullName: '', email: '' };

  async ngOnInit() {
    this.title.setTitle('Paramètres & Profil • AquaManager');
    this.meta.updateTag({
      name: 'description',
      content: 'Gérez votre profil, vos préférences d’affichage, notifications et exportez vos données sur AquaManager.',
    });

    this.form = this.fb.group({
      fullName: ['', [Validators.required, Validators.maxLength(80)]],
      email:    ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
      currentPassword: [''],
      newPassword:     [''],
    });

    this.me = await this.users.getMe();

    const rawFullName = (this.me.fullName ?? '').trim();
    const fullName = rawFullName.length > 0 ? rawFullName : (this.me.email?.split('@')[0] ?? '');

    this.form.patchValue({
      fullName,
      email: this.me.email ?? '',
    });

    this.orig.fullName = fullName;
    this.orig.email    = this.me.email ?? '';

    const raw = localStorage.getItem('aquamanager:prefs');
    if (raw) {
      try {
        this.prefs = { ...this.prefs, ...JSON.parse(raw) };
      } catch {}
    }
  }

  private get role(): AppRole {
    const r = String(this.me?.role ?? '').toUpperCase();
    if (r === 'ADMIN' || r === 'SUPERADMIN' || r === 'EDITOR' || r === 'USER') return r as AppRole;
    return 'USER';
  }

  get isAdmin(): boolean {
    return this.role === 'ADMIN' || this.role === 'SUPERADMIN';
  }

  get isEditorOnly(): boolean {
    // ✅ rôle EXACT = EDITOR (sert pour l’affichage badge)
    return this.role === 'EDITOR';
  }

  get isEditor(): boolean {
    // ✅ un admin a aussi accès aux écrans éditeur
    return this.isAdmin || this.role === 'EDITOR';
  }

  get roleLabel(): string {
    if (this.isAdmin) return 'Admin';
    if (this.role === 'EDITOR') return 'Éditeur';
    return 'User';
  }

  get roleCss(): string {
    if (this.isAdmin) return '-admin';
    if (this.role === 'EDITOR') return '-editor';
    return '-user';
  }

  get fullNameCtrl() { return this.form.get('fullName')!; }
  get emailCtrl()    { return this.form.get('email')!; }
  get currPwdCtrl()  { return this.form.get('currentPassword')!; }
  get newPwdCtrl()   { return this.form.get('newPassword')!; }

  get hasChanges(): boolean {
    const v = this.form.value as any;
    return (
      v.fullName?.trim() !== this.orig.fullName ||
      v.email?.trim()    !== this.orig.email ||
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
      if (v.email?.trim()    !== this.orig.email)    profileDto.email    = v.email.trim();

      if (Object.keys(profileDto).length) {
        const updated = await this.users.updateMe(profileDto);
        this.me = { ...this.me, ...updated };
        this.orig.fullName = updated.fullName ?? this.orig.fullName;
        this.orig.email    = updated.email    ?? this.orig.email;
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
      this.snack.open(e?.error?.message || 'Échec de l’enregistrement', 'Fermer', { duration: 3200 });
    } finally {
      this.loading = false;
    }
  }

  async deleteAccount() {
    if (!confirm('Cette action est définitive. Supprimer votre compte ?')) return;
    try {
      await this.users.deleteMe();
      this.snack.open('Compte supprimé. Au revoir 👋', 'OK', { duration: 1800 });
      this.auth.logout();
    } catch (e: any) {
      this.snack.open(e?.error?.message || 'Suppression impossible', 'Fermer', { duration: 3000 });
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
