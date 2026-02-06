import { Component, Inject, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
  of,
  catchError,
  startWith,
} from 'rxjs';

import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';

type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER' | 'SAUMATRE';
type Kind = 'FISH' | 'PLANT';

type BaseCardLite = {
  id: number;
  commonName: string;
  scientificName?: string | null;
  imageUrl?: string | null;
  waterType?: WaterType | null;

  tempMin?: number | null;
  tempMax?: number | null;
  phMin?: number | null;
  phMax?: number | null;
  ghMin?: number | null;
  ghMax?: number | null;
  khMin?: number | null;
  khMax?: number | null;

  // ✅ pour le template
  imgUrl?: string | null;
  chips: string[];
};

@Component({
  selector: 'app-aquarium-add-item-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,

    MatDialogModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
  templateUrl: './aquarium-add-item-dialog.component.html',
  styleUrls: ['./aquarium-add-item-dialog.component.scss'],
})
export class AquariumAddItemDialogComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  /** ✅ Origin API sans /api (uploads servis sur /uploads hors /api) */
  private readonly apiOrigin = (environment.apiUrl || '')
    .replace(/\/$/, '')
    .replace(/\/api$/, '')
    .replace(/\/api\/$/, '');

  tabIndex = 0; // 0 fish, 1 plants
  loading = false;

  fishResults: BaseCardLite[] = [];
  plantResults: BaseCardLite[] = [];

  selectedKind: Kind = 'FISH';
  selectedId: number | null = null;

  form = this.fb.group({
    search: [''],
    count: [1],
  });

  constructor(
    private dialogRef: MatDialogRef<AquariumAddItemDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { aquariumId: number },
  ) {}

  ngOnInit(): void {
    this.form.controls.search.valueChanges
      .pipe(
        startWith(''),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          const query = String(q ?? '').trim();
          this.loading = true;
          this.selectedId = null; // reset sélection à chaque recherche

          const kind: Kind = this.tabIndex === 0 ? 'FISH' : 'PLANT';
          this.selectedKind = kind;

          if (!query) return of({ kind, items: [] as any[] });

          const url =
            kind === 'FISH'
              ? `${environment.apiUrl}/fish-cards?search=${encodeURIComponent(query)}`
              : `${environment.apiUrl}/plant-cards?search=${encodeURIComponent(query)}`;

          return this.http.get<any[]>(url).pipe(
            catchError(() => of([])),
            switchMap((items) => of({ kind, items })),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(({ kind, items }) => {
        this.loading = false;
        const decorated = this.decorate(items ?? []);

        if (kind === 'FISH') this.fishResults = decorated;
        else this.plantResults = decorated;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTabChange(idx: number) {
    this.tabIndex = idx;
    this.selectedKind = this.tabIndex === 0 ? 'FISH' : 'PLANT';
    this.selectedId = null;
    this.form.patchValue({ search: this.form.value.search ?? '' });
  }

  /** ====== Helpers utilisés dans le HTML ====== */

  currentKind(): Kind {
    return this.tabIndex === 0 ? 'FISH' : 'PLANT';
  }

  items(): BaseCardLite[] {
    return this.currentKind() === 'FISH' ? this.fishResults : this.plantResults;
  }

  trackById = (_: number, it: BaseCardLite) => it.id;

  isSelected(id: number): boolean {
    return this.selectedId === id;
  }

  select(it: BaseCardLite) {
    this.selectedKind = this.currentKind();
    this.selectedId = it.id;
    const c = Number(this.form.value.count) || 1;
    this.form.patchValue({ count: Math.max(1, c) });
  }

  /** ✅ construit URL image /uploads */
  private img(src?: string | null): string | null {
    const p = String(src ?? '').trim();
    if (!p) return null;

    if (/^https?:\/\//i.test(p)) return p;
    if (p.startsWith('/')) return `${this.apiOrigin}${p}`;
    return `${this.apiOrigin}/${p}`;
  }

  private waterLine(item: any): string[] {
    const parts: string[] = [];

    const tmin = item?.tempMin ?? null;
    const tmax = item?.tempMax ?? null;
    const phmin = item?.phMin ?? null;
    const phmax = item?.phMax ?? null;

    if (tmin != null || tmax != null) parts.push(`Temp ${tmin ?? '—'}-${tmax ?? '—'}°C`);
    if (phmin != null || phmax != null) parts.push(`pH ${phmin ?? '—'}-${phmax ?? '—'}`);

    const ghmin = item?.ghMin ?? null;
    const ghmax = item?.ghMax ?? null;
    const khmin = item?.khMin ?? null;
    const khmax = item?.khMax ?? null;

    if (ghmin != null || ghmax != null) parts.push(`GH ${ghmin ?? '—'}-${ghmax ?? '—'}`);
    if (khmin != null || khmax != null) parts.push(`KH ${khmin ?? '—'}-${khmax ?? '—'}`);

    return parts;
  }

  /** ✅ transforme la réponse API en objet directement utilisable par le HTML */
  private decorate(items: any[]): BaseCardLite[] {
    return (items ?? []).map((it) => ({
      ...it,
      imgUrl: this.img(it?.imageUrl),
      chips: this.waterLine(it),
    }));
  }

  inc() {
    const v = Number(this.form.value.count) || 1;
    this.form.patchValue({ count: Math.min(999, v + 1) });
  }

  dec() {
    const v = Number(this.form.value.count) || 1;
    this.form.patchValue({ count: Math.max(1, v - 1) });
  }

  openDetails(kind: Kind, id: number) {
    const path = kind === 'FISH' ? `/fish-cards/${id}` : `/plant-cards/${id}`;
    window.open(path, '_blank');
  }

  confirmSelected() {
    if (!this.selectedId) return;

    const count = Math.max(1, Number(this.form.value.count) || 1);
    this.dialogRef.close({
      kind: this.selectedKind,
      cardId: this.selectedId,
      count,
    });
  }

  close() {
    this.dialogRef.close(null);
  }
}
