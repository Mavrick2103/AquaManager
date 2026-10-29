import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AdminSidebarComponent } from '../../shared/admin-sidebar/admin-sidebar.component';
import { environment } from '../../../environments/environment';

interface Counts { registered: number; aquarium: number; activated: number; measurement: number; task: number; solutions: number; returnEligible: number; returned: number; checkout: number; paid: number; }
interface JourneyReport {
  generatedAt: string; totals: Counts; cohorts: (Counts & { month: string })[];
  total: number; page: number; pageSize: number;
  items: { id: number; fullName: string; createdAt: string; firstActionAt: string | null; lastActivityAt: string | null; stage: string }[];
}
@Component({ standalone: true, imports: [CommonModule, FormsModule, RouterLink, AdminSidebarComponent],
  templateUrl: './admin-journey.component.html', styleUrl: './admin-journey.component.scss' })
export class AdminJourneyComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private request = 0;
  data: JourneyReport | null = null;
  loading = false;
  error = '';
  days = '90'; stage = ''; page = 1;
  readonly steps = [
    { key: 'aquarium' as const, label: 'Aquarium créé', description: 'Au moins un aquarium enregistré.' },
    { key: 'activated' as const, label: 'Suivi commencé', description: 'Une mesure ajoutée, une tâche créée ou les Solutions ouvertes.' },
    { key: 'measurement' as const, label: 'Première mesure', description: 'Au moins une mesure enregistrée.' },
    { key: 'task' as const, label: 'Entretien planifié', description: 'Au moins une tâche créée.' },
    { key: 'solutions' as const, label: 'Solutions découvertes', description: 'Assistant AquaManager ouvert.' },
  ];
  ngOnInit() { void this.load(); }
  async load(reset = false) {
    if (reset) this.page = 1;
    const request = ++this.request;
    this.loading = true; this.error = ''; this.data = null;
    try {
      const data = await firstValueFrom(this.http.get<JourneyReport>(`${environment.apiUrl}/admin/journey`, {
        params: { days: this.days, stage: this.stage, page: this.page },
      }));
      if (request === this.request) { this.data = data; this.page = data.page; }
    } catch {
      if (request === this.request) this.error = 'Le suivi est indisponible. Réessaie ; aucun résultat ne peut être déduit pour le moment.';
    } finally { if (request === this.request) this.loading = false; }
  }
  rate(value: number, total: number): string { return total ? `${Math.round(value / total * 100)} %` : '—'; }
  move(delta: number) { this.page += delta; void this.load(); }
}
