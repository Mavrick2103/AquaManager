// task-dialog.component.ts
import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AquariumsService, Aquarium } from '../../../core/aquariums.service';
import {
  CreateTaskPayload,
  TaskType,
  RepeatMode,
  WeekDayKey,
  FertilizerLine,
  RepeatPayload,
} from '../../../core/tasks.service';

const WEEK_DAYS: Array<{ key: WeekDayKey; label: string }> = [
  { key: 'MON', label: 'Lun' },
  { key: 'TUE', label: 'Mar' },
  { key: 'WED', label: 'Mer' },
  { key: 'THU', label: 'Jeu' },
  { key: 'FRI', label: 'Ven' },
  { key: 'SAT', label: 'Sam' },
  { key: 'SUN', label: 'Dim' },
];

function fertilizersRequiredWhenFertilization(ctrl: AbstractControl): ValidationErrors | null {
  const type = ctrl.get('type')?.value as TaskType | undefined;
  const arr = ctrl.get('fertilizers') as FormArray | null;

  if (type !== 'FERTILIZATION') return null;
  if (!arr || arr.length === 0) return { fertilizersRequired: true };

  const ok = arr.controls.some((c) => {
    const name = (c.get('name')?.value ?? '').toString().trim();
    const qty = Number(c.get('qty')?.value ?? 0);
    return name.length > 0 && Number.isFinite(qty) && qty > 0;
  });

  return ok ? null : { fertilizersRequired: true };
}

@Component({
  selector: 'app-task-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatChipsModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './task-dialog.component.html',
  styleUrls: ['./task-dialog.component.scss'],
})
export class TaskDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<TaskDialogComponent>);
  private aquariumsApi = inject(AquariumsService);

  constructor(@Inject(MAT_DIALOG_DATA) public data: { date?: Date } | null) {}

  types: Array<{ value: TaskType; label: string; icon: string }> = [
    { value: 'WATER_CHANGE', label: 'Changement d’eau', icon: 'water_drop' },
    { value: 'FERTILIZATION', label: 'Fertilisation', icon: 'science' },
    { value: 'TRIM', label: 'Taille / entretien', icon: 'content_cut' },
    { value: 'WATER_TEST', label: 'Test de l’eau', icon: 'biotech' },
    { value: 'OTHER', label: 'Autre', icon: 'category' },
  ];

  repeatOptions: Array<{ value: RepeatMode; label: string }> = [
    { value: 'NONE', label: 'Aucune' },
    { value: 'DAILY', label: 'Tous les jours' },
    { value: 'EVERY_2_DAYS', label: 'Tous les 2 jours' },
    { value: 'WEEKLY', label: 'Toutes les semaines' },
    { value: 'EVERY_X_WEEKS', label: 'Toutes les X semaines' },
  ];

  weekDays = WEEK_DAYS;

  private aquariumsList: Aquarium[] = [];
  aquariums() {
    return this.aquariumsList;
  }
  loadingAquariums = true;

  form = this.fb.group(
    {
      title: ['', [Validators.required, Validators.maxLength(200)]],
      description: [''],
      date: [new Date(), Validators.required],
      time: ['09:00'],
      aquariumId: [null as number | null, Validators.required],
      type: ['OTHER' as TaskType, Validators.required],

      // ===== Répétition =====
      isRepeat: [false],
      repeatMode: ['NONE' as RepeatMode],
      repeatEveryWeeks: [{ value: 2, disabled: true }, [Validators.min(2), Validators.max(12)]],
      repeatDays: this.fb.control<WeekDayKey[]>(['MON']),

      // ✅ NEW: fin de répétition (sinon indéfini)
      repeatHasEnd: [{ value: false, disabled: true }],
      repeatDurationWeeks: [{ value: 4, disabled: true }, [Validators.min(1), Validators.max(260)]],

      // ===== Fertilisation =====
      fertilizers: this.fb.array([]),
    },
    { validators: fertilizersRequiredWhenFertilization },
  );

  get fertilizers(): FormArray {
    return this.form.get('fertilizers') as FormArray;
  }

  private titleForType(type: TaskType): string | null {
    switch (type) {
      case 'WATER_CHANGE':
        return 'Changement d’eau';
      case 'FERTILIZATION':
        return 'Fertilisation';
      case 'TRIM':
        return 'Taille / entretien';
      case 'WATER_TEST':
        return 'Test de l’eau';
      default:
        return null; // OTHER
    }
  }

  private applyAutoTitle(type: TaskType) {
    const titleCtrl = this.form.get('title')!;
    const auto = this.titleForType(type);

    if (!auto) {
      // OTHER => l’utilisateur gère
      titleCtrl.enable({ emitEvent: false });
      if (!titleCtrl.value) titleCtrl.setValue('', { emitEvent: false });
      return;
    }

    // type != OTHER => titre imposé
    titleCtrl.setValue(auto, { emitEvent: false });
    titleCtrl.disable({ emitEvent: false });
  }

  ngOnInit(): void {
    if (this.data?.date instanceof Date) {
      this.form.patchValue({ date: this.data.date });
    }

    // init titre auto
    this.applyAutoTitle(this.form.get('type')!.value as TaskType);

    this.aquariumsApi.listMine().subscribe({
      next: (list) => {
        this.aquariumsList = list || [];
        this.loadingAquariums = false;

        if (this.aquariumsList.length && !this.form.value.aquariumId) {
          this.form.patchValue({ aquariumId: this.aquariumsList[0].id });
        }
      },
      error: () => {
        this.aquariumsList = [];
        this.loadingAquariums = false;
      },
    });

    // type change => titre auto + fertil
    this.form.get('type')!.valueChanges.subscribe((t) => {
      const type = (t ?? 'OTHER') as TaskType;
      this.applyAutoTitle(type);

      if (type === 'FERTILIZATION' && this.fertilizers.length === 0) {
        this.addFertilizerLine();
      }

      this.form.updateValueAndValidity();
    });

    // repeat toggle => active les contrôles de répétition
    this.form.get('isRepeat')!.valueChanges.subscribe((on) => {
      const hasEndCtrl = this.form.get('repeatHasEnd')!;
      const durationCtrl = this.form.get('repeatDurationWeeks')!;

      if (!on) {
        this.form.patchValue({ repeatMode: 'NONE', repeatHasEnd: false }, { emitEvent: false });
        hasEndCtrl.disable({ emitEvent: false });
        durationCtrl.disable({ emitEvent: false });
      } else {
        if (this.form.get('repeatMode')!.value === 'NONE') {
          this.form.patchValue({ repeatMode: 'WEEKLY' }, { emitEvent: false });
        }
        hasEndCtrl.enable({ emitEvent: false });

        // si fin activée => durée activée, sinon indéfini => durée désactivée
        if (hasEndCtrl.value) durationCtrl.enable({ emitEvent: false });
        else durationCtrl.disable({ emitEvent: false });
      }
    });

    // fin de répétition => enable/disable durée
    this.form.get('repeatHasEnd')!.valueChanges.subscribe((hasEnd) => {
      const durationCtrl = this.form.get('repeatDurationWeeks')!;
      if (hasEnd && this.form.get('isRepeat')!.value) durationCtrl.enable({ emitEvent: false });
      else durationCtrl.disable({ emitEvent: false });
    });

    // mode => toggle everyWeeks
    this.form.get('repeatMode')!.valueChanges.subscribe((mode) => {
      if (mode === 'NONE' && this.form.get('isRepeat')!.value) {
        this.form.patchValue({ isRepeat: false }, { emitEvent: false });
      }
      if (mode !== 'NONE' && !this.form.get('isRepeat')!.value) {
        this.form.patchValue({ isRepeat: true }, { emitEvent: false });
      }

      const everyCtrl = this.form.get('repeatEveryWeeks')!;
      if (mode === 'EVERY_X_WEEKS') everyCtrl.enable({ emitEvent: false });
      else everyCtrl.disable({ emitEvent: false });
    });
  }

  addFertilizerLine(): void {
    const g = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(40)]],
      qty: [1, [Validators.required, Validators.min(0.01)]],
      unit: ['ml' as 'ml' | 'g'],
    });
    this.fertilizers.push(g);
    this.form.updateValueAndValidity();
  }

  removeFertilizerLine(i: number): void {
    this.fertilizers.removeAt(i);
    this.form.updateValueAndValidity();
  }

  isRepeatWeekly(): boolean {
    const on = !!this.form.get('isRepeat')!.value;
    const mode = this.form.get('repeatMode')!.value as RepeatMode;
    return on && (mode === 'WEEKLY' || mode === 'EVERY_X_WEEKS');
  }

  toggleDay(day: WeekDayKey): void {
    const current = (this.form.get('repeatDays')!.value ?? []) as WeekDayKey[];
    const set = new Set(current);

    if (set.has(day)) set.delete(day);
    else set.add(day);

    if (this.isRepeatWeekly() && set.size === 0) set.add('MON');

    this.form.patchValue({ repeatDays: Array.from(set) as WeekDayKey[] });
  }

  isDaySelected(day: WeekDayKey): boolean {
    const current = (this.form.get('repeatDays')!.value ?? []) as WeekDayKey[];
    return current.includes(day);
  }

  private buildIsoDueAt(date: Date | null, time: string | null): string {
    const d = date ?? new Date();
    const hhmm = time && /^\d{2}:\d{2}$/.test(time) ? time : '09:00';
    const [h, m] = hhmm.split(':').map((n) => +n);
    const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
    return local.toISOString();
  }

  private buildRepeatPayload(v: any): RepeatPayload {
    if (!v.isRepeat) return null;

    const mode = v.repeatMode as RepeatMode;
    if (!mode || mode === 'NONE') return null;

    const hasEnd = !!v.repeatHasEnd;
    const durationWeeks = hasEnd ? Number(v.repeatDurationWeeks ?? 4) : undefined;

    return {
      mode,
      // ✅ indéfini => durationWeeks absent
      durationWeeks: hasEnd && Number.isFinite(durationWeeks) ? durationWeeks : undefined,
      everyWeeks: mode === 'EVERY_X_WEEKS' ? Number(v.repeatEveryWeeks ?? 2) : undefined,
      days: this.isRepeatWeekly() ? ((v.repeatDays ?? ['MON']) as WeekDayKey[]) : undefined,
    };
  }

  private buildFertilization(v: any): FertilizerLine[] | null {
    if (v.type !== 'FERTILIZATION') return null;

    const lines = (v.fertilizers ?? [])
      .map((x: any) => {
        const unit = (x?.unit === 'g' ? 'g' : 'ml') as 'g' | 'ml';
        return {
          name: (x?.name ?? '').toString().trim(),
          qty: Number(x?.qty ?? 0),
          unit,
        };
      })
      .filter((x: FertilizerLine) => x.name.length > 0 && Number.isFinite(x.qty) && x.qty > 0);

    return lines.length ? lines : null;
  }

  save(): void {
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity();
    if (this.form.invalid) return;

    if (!this.aquariumsList.length) {
      alert('Crée d’abord un aquarium pour associer la tâche.');
      return;
    }

    const v = this.form.getRawValue();

    const payload: CreateTaskPayload = {
      title: (v.title ?? '').toString().trim(),
      description: (v.description ?? '').toString().trim() || undefined,
      type: v.type as TaskType,
      aquariumId: v.aquariumId as number,
      dueAt: this.buildIsoDueAt(v.date as Date, v.time || '09:00'),
      repeat: this.buildRepeatPayload(v),
      fertilization: this.buildFertilization(v),
    };

    this.dialogRef.close(payload);
  }
}
