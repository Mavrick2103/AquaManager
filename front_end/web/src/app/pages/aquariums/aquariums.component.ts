import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import {
  AquariumsService,
  Aquarium,
  AquariumOverview,
} from '../../core/aquariums.service';
import { UserMe, UserService } from '../../core/user.service';
import { firstValueFrom } from 'rxjs';
import { AquariumDialogComponent } from './dialog/aquarium-dialog.component';

@Component({
  selector: 'app-aquariums',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatDialogModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './aquariums.component.html',
  styleUrls: ['./aquariums.component.scss'],
})
export class AquariumsComponent implements OnInit {
  items: AquariumOverview[] = [];
  loading = false;
  effectivePlan: 'CLASSIC' | 'PREMIUM' | 'PRO' = 'CLASSIC';
  activeFilter: 'ALL' | 'ATTENTION' | 'STABLE' = 'ALL';

  constructor(
    private dialog: MatDialog,
    private api: AquariumsService,
    private router: Router,
    private users: UserService,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() { this.load(); }

  async load() {
    this.loading = true;
    try {
      const [items, me] = await Promise.all([
        firstValueFrom(this.api.overview()),
        this.users.getMe(),
      ]);
      this.items = items;
      this.effectivePlan = this.resolveEffectivePlan(me);
    } finally {
      this.loading = false;
    }
  }

  openCreate() {
    if (this.isAtLimit) {
      this.snack.open(
        `La limite de ${this.aquariumLimit} aquariums du plan ${this.planLabel} est atteinte.`,
        'Fermer',
        { duration: 4500 },
      );
      return;
    }

    const ref = this.dialog.open(AquariumDialogComponent, {
      width: '720px',
      autoFocus: false,
    });
    ref.afterClosed().subscribe(result => {
      if (!result?.aquarium) return;

      if (result.setupCycling) {
        this.router.navigate(['/aquariums', result.aquarium.id], {
          queryParams: { protocol: 'STARTUP' },
        });
        return;
      }

      this.load();
    });
  }

  goTo(a: Aquarium) {
    this.router.navigate(['/aquariums', a.id]);
  }

  addMeasurement(a: Aquarium, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/aquariums', a.id], {
      queryParams: { action: 'measure' },
    });
  }

  litersOf(a: Aquarium): number {
    return Math.round((a.lengthCm * a.widthCm * a.heightCm) / 1000);
  }

  get aquariumLimit(): number | null {
    if (this.effectivePlan === 'CLASSIC') return 2;
    if (this.effectivePlan === 'PREMIUM') return 5;
    return null;
  }

  get isAtLimit(): boolean {
    return this.aquariumLimit !== null && this.items.length >= this.aquariumLimit;
  }

  get planLabel(): string {
    if (this.effectivePlan === 'PRO') return 'Pro';
    if (this.effectivePlan === 'PREMIUM') return 'Premium';
    return 'Classic';
  }

  get displayedItems(): AquariumOverview[] {
    const filtered = this.items.filter((aquarium) => {
      const status = this.aquariumStatus(aquarium);
      if (this.activeFilter === 'ATTENTION') return status !== 'stable';
      if (this.activeFilter === 'STABLE') return status === 'stable';
      return true;
    });

    const rank = (aquarium: AquariumOverview) => {
      const status = this.aquariumStatus(aquarium);
      return status === 'urgent' ? 0 : status === 'measure' ? 1 : 2;
    };
    return [...filtered].sort((a, b) => rank(a) - rank(b));
  }

  get attentionCount(): number {
    return this.items.filter((aquarium) => this.aquariumStatus(aquarium) !== 'stable').length;
  }

  aquariumStatus(aquarium: AquariumOverview): 'stable' | 'measure' | 'urgent' {
    if (aquarium.overdueTaskCount > 0) return 'urgent';
    if (!aquarium.lastMeasuredAt) return 'measure';
    const elapsedDays = Math.floor(
      (Date.now() - new Date(aquarium.lastMeasuredAt).getTime()) / 86400000,
    );
    return elapsedDays > 14 ? 'measure' : 'stable';
  }

  statusLabel(aquarium: AquariumOverview): string {
    const status = this.aquariumStatus(aquarium);
    if (status === 'urgent') return 'Action nécessaire';
    if (status === 'measure') return aquarium.lastMeasuredAt ? 'Mesure à renouveler' : 'Première mesure attendue';
    return 'Suivi à jour';
  }

  measurementLabel(aquarium: AquariumOverview): string {
    if (!aquarium.lastMeasuredAt) return 'Aucune mesure';
    const elapsedDays = Math.max(
      0,
      Math.floor((Date.now() - new Date(aquarium.lastMeasuredAt).getTime()) / 86400000),
    );
    if (elapsedDays === 0) return 'Mesurée aujourd’hui';
    if (elapsedDays === 1) return 'Mesurée hier';
    return `Mesurée il y a ${elapsedDays} jours`;
  }

  aquariumAge(aquarium: AquariumOverview): string {
    const start = new Date(aquarium.startDate);
    const months = Math.max(
      0,
      (new Date().getFullYear() - start.getFullYear()) * 12 +
        new Date().getMonth() -
        start.getMonth(),
    );
    if (months < 1) {
      const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
      return `${days} jour${days > 1 ? 's' : ''}`;
    }
    if (months < 12) return `${months} mois`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    return `${years} an${years > 1 ? 's' : ''}${remainingMonths ? ` et ${remainingMonths} mois` : ''}`;
  }

  goToSubscription(): void {
    this.router.navigate(['/profile']);
  }

  private resolveEffectivePlan(me: UserMe): 'CLASSIC' | 'PREMIUM' | 'PRO' {
    if (me.role === 'ADMIN') return 'PRO';

    const plan = me.subscriptionPlan ?? 'CLASSIC';
    const active = me.subscriptionStatus === 'active' || me.subscriptionStatus === 'trialing';
    const endsAt = me.subscriptionEndsAt ? new Date(me.subscriptionEndsAt).getTime() : null;
    const expired = endsAt !== null && Number.isFinite(endsAt) && endsAt < Date.now();
    return active && !expired ? plan : 'CLASSIC';
  }
}
