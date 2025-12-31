import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  selector: 'app-verify-email',
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss',
})
export class VerifyEmailComponent {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);

  loading = signal(true);
  ok = signal<boolean | null>(null);
  message = signal<string>('Vérification en cours…');

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.loading.set(false);
      this.ok.set(false);
      this.message.set('Token manquant dans l’URL.');
      return;
    }

    this.auth.verifyEmail(token)
      .then((res) => {
        this.ok.set(!!res?.ok);
        this.message.set(res?.message ?? (res?.ok ? 'Email vérifié.' : 'Lien invalide ou expiré.'));
      })
      .catch(() => {
        this.ok.set(false);
        this.message.set('Erreur serveur. Réessaie plus tard.');
      })
      .finally(() => this.loading.set(false));
  }
}
