import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { AdminSidebarComponent } from '../../../../shared/admin-sidebar/admin-sidebar.component';
import {
  DOSSIER_GROUPS,
  DOSSIER_SECTIONS,
  SETTING_FIELDS,
  PROGRESS_FIELDS,
  DossierRecord,
  DossierField,
} from './admin-user-dossier.model';
interface Dossier {
  user: DossierRecord;
  settings: DossierRecord | null;
  progress: DossierRecord | null;
  counts: Record<string, number>;
  activeSessions: number;
  archivedAquariums: number;
  generatedAt: string;
}
interface RecordPage {
  items: DossierRecord[];
  total: number;
  page: number;
  pageSize: number;
}
@Component({
  selector: 'app-admin-user-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule, AdminSidebarComponent],
  templateUrl: './admin-user-detail.component.html',
  styleUrl: './admin-user-detail.component.scss',
})
export class AdminUserDetailComponent implements OnInit, OnDestroy {
  readonly groups = DOSSIER_GROUPS;
  readonly settingsFields = SETTING_FIELDS;
  readonly progressFields = PROGRESS_FIELDS;
  data: Dossier | null = null;
  records: RecordPage | null = null;
  userId = 0;
  loading = false;
  recordsLoading = false;
  error = '';
  recordsError = '';
  group = 'overview';
  section = 'aquariums';
  page = 1;
  aquariumId: number | null = null;
  private overviewRequest?: Subscription;
  private recordsRequest?: Subscription;
  private routeRequest?: Subscription;
  private readonly base = environment.apiUrl.replace(/\/$/, '') + '/admin/users';
  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
  ) {}
  ngOnInit() {
    this.routeRequest = this.route.paramMap.subscribe((params) => {
      this.userId = Number(params.get('id'));
      this.group = 'overview';
      this.aquariumId = null;
      this.load();
    });
  }
  ngOnDestroy() {
    this.overviewRequest?.unsubscribe();
    this.recordsRequest?.unsubscribe();
    this.routeRequest?.unsubscribe();
  }
  load() {
    this.overviewRequest?.unsubscribe();
    this.recordsRequest?.unsubscribe();
    this.data = null;
    this.records = null;
    this.error = '';
    if (!Number.isSafeInteger(this.userId) || this.userId < 1) {
      this.error = 'Choisissez un utilisateur depuis l’annuaire pour ouvrir sa fiche.';
      this.loading = false;
      return;
    }
    this.loading = true;
    this.overviewRequest = this.http.get<Dossier>(`${this.base}/${this.userId}/dossier`).subscribe({
      next: (data) => {
        this.data = data;
        this.loading = false;
        if (this.group !== 'overview') this.loadRecords();
      },
      error: (e) => {
        this.loading = false;
        this.error =
          e.status === 404
            ? 'Ce compte n’existe plus ou est introuvable.'
            : 'La fiche ne peut pas être chargée pour le moment. Réessayez.';
      },
    });
  }
  get sectionOptions() {
    const keys = this.groups.find((g) => g.key === this.group)?.sections ?? [];
    return DOSSIER_SECTIONS.filter((s) => keys.includes(s.key));
  }
  get totalPages() {
    return Math.max(1, Math.ceil((this.records?.total ?? 0) / 25));
  }
  get current() {
    return DOSSIER_SECTIONS.find((s) => s.key === this.section)!;
  }
  get effectivePlan() {
    const u = this.data?.user;
    if (!u) return '—';
    if (['ADMIN', 'SUPERADMIN'].includes(u['role'])) return 'PRO';
    return ['active', 'trialing'].includes(u['subscriptionStatus']) &&
      (!u['subscriptionEndsAt'] || Date.parse(u['subscriptionEndsAt']) > Date.now())
      ? u['subscriptionPlan']
      : 'CLASSIC';
  }
  get initials() {
    return String(this.data?.user['fullName'] || this.data?.user['email'] || '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0))
      .join('')
      .toUpperCase();
  }
  selectGroup(key: string) {
    this.group = key;
    this.recordsRequest?.unsubscribe();
    this.records = null;
    this.recordsError = '';
    this.recordsLoading = false;
    this.aquariumId = null;
    if (key !== 'overview') {
      this.section = this.sectionOptions[0].key;
      this.page = 1;
      this.loadRecords();
    }
  }
  selectSection(key: string) {
    this.section = key;
    this.page = 1;
    if (!this.current.aquarium) this.aquariumId = null;
    this.loadRecords();
  }
  loadRecords() {
    this.recordsRequest?.unsubscribe();
    this.records = null;
    this.recordsError = '';
    this.recordsLoading = true;
    let params = new HttpParams().set('page', this.page);
    if (this.aquariumId && this.current.aquarium)
      params = params.set('aquariumId', this.aquariumId);
    this.recordsRequest = this.http
      .get<RecordPage>(`${this.base}/${this.userId}/records/${this.section}`, { params })
      .subscribe({
        next: (records) => {
          this.records = records;
          this.recordsLoading = false;
        },
        error: () => {
          this.recordsLoading = false;
          this.recordsError =
            'Impossible de charger cette rubrique. Les autres informations restent accessibles.';
        },
      });
  }
  next(delta: number) {
    this.page += delta;
    this.loadRecords();
  }
  inspectAquarium(id: number) {
    this.group = 'tracking';
    this.section = 'measurements';
    this.aquariumId = id;
    this.page = 1;
    this.loadRecords();
  }
  clearAquarium() {
    this.aquariumId = null;
    this.page = 1;
    this.loadRecords();
  }
  title(row: DossierRecord) {
    return (
      row['name'] ||
      row['title'] ||
      row['commonName'] ||
      this.label(row['feature']) ||
      `${this.current.label} #${row['id']}`
    );
  }
  date(value: any) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleString(
          'fr-FR',
          String(value).length === 10
            ? { dateStyle: 'medium' }
            : { dateStyle: 'medium', timeStyle: 'short' },
        );
  }
  label(value: any): string {
    if (value === null || value === undefined || value === '') return '';
    return (
      (
        {
          USER: 'Utilisateur',
          HELPFUL: '👍 Réponse utile',
          NOT_HELPFUL: '👎 Hors sujet / pas utile',
          EDITOR: 'Éditeur',
          ADMIN: 'Administrateur',
          CLASSIC: 'Classic',
          PREMIUM: 'Premium',
          PRO: 'Pro',
          active: 'Actif',
          trialing: 'Essai',
          none: 'Sans abonnement',
          canceled: 'Résilié',
          past_due: 'Paiement en retard',
          incomplete: 'Incomplet',
          ACTIVE: 'Actif',
          CANCELLED: 'Résilié',
          EXPIRED: 'Expiré',
          SUSPENDED: 'Suspendu',
          CREATING: 'Création',
          APPROVED: 'Paiement attendu',
          APPROVAL_PENDING: 'Validation attendue',
          PENDING: 'En attente',
          DONE: 'Terminée',
          COMPLETED: 'Terminée',
          PUBLISHED: 'Publié',
          PENDING_REVIEW: 'À modérer',
          DRAFT: 'Brouillon',
          REJECTED: 'Refusé',
          ACCEPTED: 'Accepté',
          SUCCESS: 'Réussie',
          FAILED: 'Échec',
          STARTED: 'Commencée',
          EAU_DOUCE: 'Eau douce',
          EAU_DE_MER: 'Eau de mer',
          live: 'Réel',
          sandbox: 'Test Sandbox',
          INFO: 'Information',
          WARN: 'À surveiller',
          URGENT: 'Urgent',
          STABLE: 'Stable',
          WATCH: 'À surveiller',
          CRITICAL: 'Critique',
          UNKNOWN: 'Non déterminé',
          TRACKING: 'Suivi',
          HEALTH: 'Santé',
          DAILY: 'Chaque jour',
          EVERY_2_DAYS: 'Tous les 2 jours',
          WEEKLY: 'Chaque semaine',
          EVERY_X_WEEKS: 'Toutes les X semaines',
          NONE: 'Aucune',
          WATER_CHANGE: 'Changement d’eau',
          FERTILIZATION: 'Fertilisation',
          TRIM: 'Taille',
          WATER_TEST: 'Analyse de l’eau',
          OTHER: 'Autre',
          BEGINNER_FRESHWATER: 'Eau douce · débutant',
          BEGINNER_SALTWATER: 'Eau de mer · débutant',
          CUSTOM: 'Personnalisé',
          system: 'Système',
          light: 'Clair',
          dark: 'Sombre',
          cards: 'Cartes',
          table: 'Tableau',
          C: '°C',
          F: '°F',
          L: 'Litres',
          GAL: 'Gallons',
          MON: 'Lundi',
          TUE: 'Mardi',
          WED: 'Mercredi',
          THU: 'Jeudi',
          FRI: 'Vendredi',
          SAT: 'Samedi',
          SUN: 'Dimanche',
        } as Record<string, string>
      )[String(value)] ?? String(value)
    );
  }
  value(row: DossierRecord, field: DossierField): string {
    const v = row[field.key];
    if (v == null && field.key === 'questionText') return 'Question non enregistrée pour cette ancienne analyse';
    if (v == null && field.key === 'feedback') return 'Aucun avis';
    if (v === null || v === undefined || v === '') return 'Non renseigné';
    if (field.kind === 'date') return this.date(v);
    if (field.kind === 'boolean') return v === true || v === 1 || v === '1' ? 'Oui' : 'Non';
    if (field.kind === 'object') return this.structured(v);
    if (field.kind === 'text') return String(v);
    return this.label(v) + (field.unit ? ' ' + field.unit : '');
  }
  structured(value: any): string {
    if (typeof value === 'string') {
      try {
        return this.structured(JSON.parse(value));
      } catch {
        return value;
      }
    }
    if (Array.isArray(value))
      return value.length
        ? value.map((v) => (typeof v === 'object' ? this.structured(v) : this.label(v))).join('\n')
        : 'Aucun';
    if (value && typeof value === 'object')
      return Object.entries(value)
        .map(
          ([k, v]) =>
            `${({ min: 'Minimum', max: 'Maximum', name: 'Nom', qty: 'Quantité', unit: 'Unité', taskId: 'Tâche', mode: 'Mode', bonuses: 'Bonus', penalties: 'Points de vigilance', lastMeasurementAt: 'Dernière mesure', tracking: 'Suivi', hasRecentMeasurement: 'Mesure récente', hasHistory: 'Historique', aquariumCompleted: 'Aquarium complété', measuredParams: 'Paramètres mesurés', inRangeParams: 'Dans les objectifs', outOfRangeParams: 'Hors objectifs', criticalParams: 'Paramètres critiques', key: 'Paramètre', value: 'Valeur' } as Record<string, string>)[k] ?? k} : ${this.structured(v)}`,
        )
        .join('\n');
    return typeof value === 'boolean'
      ? value
        ? 'Oui'
        : 'Non'
      : value == null
        ? 'Non renseigné'
        : this.label(value);
  }
}
