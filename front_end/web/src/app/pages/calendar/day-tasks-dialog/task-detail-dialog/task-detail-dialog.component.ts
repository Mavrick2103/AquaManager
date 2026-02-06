import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  TasksService,
  Task,
  TaskType,
  RepeatMode,
  WeekDayKey,
  RepeatPayload,
  FertilizerLine,
  UpdateTaskPayload,
} from '../../../../core/tasks.service';
import { AquariumsService, Aquarium } from '../../../../core/aquariums.service';

const WEEK_DAYS: Array<{ key: WeekDayKey; label: string }> = [
  { key: 'MON', label: 'Lun' },
  { key: 'TUE', label: 'Mar' },
  { key: 'WED', label: 'Mer' },
  { key: 'THU', label: 'Jeu' },
  { key: 'FRI', label: 'Ven' },
  { key: 'SAT', label: 'Sam' },
  { key: 'SUN', label: 'Dim' },
];

function toNumber(v: unknown, fallback: number): number {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

@Component({
  selector: 'app-task-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './task-detail-dialog.component.html',
  styleUrls: ['./task-detail-dialog.component.scss'],
})
export class TaskDetailDialogComponent implements OnInit {
  private ref = inject(MatDialogRef<TaskDetailDialogComponent>);
  private tasksApi = inject(TasksService);
  private aquariumsApi = inject(AquariumsService);

  saving = false;

  aquariums: Aquarium[] = [];
  selectedAquariumId: number | null = null;

  weekDays = WEEK_DAYS;

  editing: {
    id: number;
    title: string;
    description: string;
    dueAtLocal: string; // datetime-local
    type: TaskType;
  };

  repeatOn = false;
  repeatMode: Exclude<RepeatMode, 'NONE'> = 'WEEKLY';
  repeatEveryWeeks = 2;
  repeatDays: WeekDayKey[] = ['MON'];

  // ✅ NOUVEAU : durée de répétition (anti-infini)
  repeatDurationWeeks = 4;

  fertilization: FertilizerLine[] = [{ name: '', qty: 1, unit: 'ml' }];

  trackByIndex = (i: number) => i;

  constructor(@Inject(MAT_DIALOG_DATA) public data: { task: Task }) {
    const t = data.task;

    this.editing = {
      id: t.id,
      title: t.title ?? '',
      description: t.description ?? '',
      dueAtLocal: this.toLocalInputValue(t.dueAt),
      type: t.type,
    };

    this.selectedAquariumId = t.aquarium?.id ?? null;

    // hydrate repeat
    if (t.repeat?.mode && t.repeat.mode !== 'NONE') {
      this.repeatOn = true;
      this.repeatMode = t.repeat.mode as Exclude<RepeatMode, 'NONE'>;
      this.repeatEveryWeeks = toNumber(t.repeat.everyWeeks, 2);
      this.repeatDays = (t.repeat.days?.length ? t.repeat.days : ['MON']) as WeekDayKey[];

      // ✅ hydrate durée (si absent -> défaut 4 semaines)
      this.repeatDurationWeeks = Math.min(260, Math.max(1, toNumber((t.repeat as any)?.durationWeeks, 4)));
    }

    // hydrate fertilization
    if (t.type === 'FERTILIZATION') {
      const lines = Array.isArray(t.fertilization) ? t.fertilization : [];
      this.fertilization = lines.length
        ? lines.map((x) => ({
            name: (x?.name ?? '').toString(),
            qty: toNumber((x as any)?.qty, 1),
            unit: (x as any)?.unit === 'g' ? 'g' : 'ml',
          }))
        : [{ name: '', qty: 1, unit: 'ml' }];
    }
  }

  ngOnInit(): void {
    this.aquariumsApi.listMine().subscribe({
      next: (list) => {
        this.aquariums = list || [];
        if (!this.selectedAquariumId && this.aquariums.length) {
          this.selectedAquariumId = this.aquariums[0].id;
        }
      },
      error: () => (this.aquariums = []),
    });
  }

  // ---------- Helpers date ----------
  private toLocalInputValue(iso: string): string {
    if (iso && iso.length === 16 && iso.includes('T')) return iso;

    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes(),
    )}`;
  }

  private toIsoUtcFromLocalInput(localInput: string): string {
    const d = new Date(localInput);
    return d.toISOString();
  }

  // ---------- Repeat UI ----------
  isDaySelected(day: WeekDayKey): boolean {
    return this.repeatDays.includes(day);
  }

  toggleDay(day: WeekDayKey): void {
    const set = new Set(this.repeatDays);
    if (set.has(day)) set.delete(day);
    else set.add(day);

    if (this.repeatOn && (this.repeatMode === 'WEEKLY' || this.repeatMode === 'EVERY_X_WEEKS') && set.size === 0) {
      set.add('MON');
    }

    this.repeatDays = Array.from(set);
  }

  private buildRepeatPayload(): RepeatPayload {
    if (!this.repeatOn) return null;

    const mode = this.repeatMode;

    // ✅ durée: 1 à 260 semaines (~5 ans)
    const durationWeeks = Math.min(260, Math.max(1, toNumber(this.repeatDurationWeeks, 4)));

    if (mode === 'DAILY' || mode === 'EVERY_2_DAYS') {
      return { mode, durationWeeks };
    }

    if (mode === 'WEEKLY') {
      return {
        mode,
        days: (this.repeatDays?.length ? this.repeatDays : ['MON']) as WeekDayKey[],
        durationWeeks,
      };
    }

    return {
      mode,
      everyWeeks: Math.min(52, Math.max(2, toNumber(this.repeatEveryWeeks, 2))),
      days: (this.repeatDays?.length ? this.repeatDays : ['MON']) as WeekDayKey[],
      durationWeeks,
    };
  }

  // ---------- Fertilization UI ----------
  addFertilizerLine(): void {
    this.fertilization = [...this.fertilization, { name: '', qty: 1, unit: 'ml' }];
  }

  removeFertilizerLine(i: number): void {
    if (this.fertilization.length <= 1) return;
    this.fertilization = this.fertilization.filter((_, idx) => idx !== i);
  }

  isFertilizationValid(): boolean {
    if (this.editing.type !== 'FERTILIZATION') return true;

    return (this.fertilization ?? []).some((l) => {
      const name = (l.name ?? '').toString().trim();
      const qty = toNumber(l.qty, 0);
      return name.length > 0 && qty > 0;
    });
  }

  private normalizeFertilization(): FertilizerLine[] | null {
    if (this.editing.type !== 'FERTILIZATION') return null;

    const lines = (this.fertilization ?? [])
      .map((l) => ({
        name: (l.name ?? '').toString().trim(),
        qty: toNumber(l.qty, 0),
        unit: (l.unit === 'g' ? 'g' : 'ml') as 'g' | 'ml',
      }))
      .filter((l) => l.name.length > 0 && l.qty > 0);

    return lines;
  }

  // ---------- Actions ----------
  save(): void {
    const title = (this.editing.title || '').trim();
    if (!title) return alert('Titre requis.');
    if (!this.selectedAquariumId) return alert('Sélectionne un aquarium.');
    if (!this.editing.dueAtLocal) return alert('Date/heure requise.');
    if (!this.isFertilizationValid()) return alert('Fertilisation invalide.');

    // ✅ garde-fou durée
    if (this.repeatOn) {
      const d = toNumber(this.repeatDurationWeeks, 0);
      if (!(d > 0)) return alert('Durée de répétition invalide.');
    }

    const payload: UpdateTaskPayload = {
      title,
      description: (this.editing.description ?? '').toString().trim() || undefined,
      dueAt: this.toIsoUtcFromLocalInput(this.editing.dueAtLocal),
      type: this.editing.type,
      aquariumId: this.selectedAquariumId,
      repeat: this.buildRepeatPayload(),
      fertilization: this.normalizeFertilization(),
    };

    this.saving = true;
    this.tasksApi.update(this.editing.id, payload).subscribe({
      next: (res) => this.ref.close(res),
      error: (err: unknown) => {
        console.error(err);
        this.saving = false;
        alert('Erreur lors de la mise à jour.');
      },
    });
  }

  delete(): void {
    const ok = confirm(`Supprimer la tâche « ${this.editing.title} » ?`);
    if (!ok) return;

    this.tasksApi.delete(this.editing.id).subscribe({
      next: () => this.ref.close({ deleted: true }),
      error: (err: unknown) => {
        console.error(err);
        alert('Erreur lors de la suppression');
      },
    });
  }

  cancel(): void {
    this.ref.close();
  }
}
