import { Injectable, signal } from '@angular/core';

export type TutorialAquarium = { id: number; name: string; lengthCm: number; widthCm: number; heightCm: number; waterType: 'EAU_DOUCE' | 'EAU_DE_MER'; startDate: string };
export type TutorialMeasurement = { label: string; ph: number; temp: number; no2: number; no3: number; gh: number; kh: number };

@Injectable({ providedIn: 'root' })
export class TutorialDataService {
  readonly aquarium = signal<TutorialAquarium | null>(null);
  readonly measurement = signal<Record<string, unknown> | null>(null);
  readonly measurements = signal<TutorialMeasurement[]>([]);
  readonly taskCompleted = signal(false);
  readonly solutionTaskCreated = signal(false);

  reset(): void {
    this.aquarium.set(null); this.measurement.set(null); this.measurements.set([]);
    this.taskCompleted.set(false);
    this.solutionTaskCreated.set(false);
  }

  prepareStep(_id: string): void {
    if (!this.aquarium()) this.aquarium.set({ id: -1, name: 'Mon bac de découverte', lengthCm: 60, widthCm: 30, heightCm: 35, waterType: 'EAU_DOUCE', startDate: new Date().toISOString().slice(0, 10) });
    if (!this.measurement()) this.createMeasurementHistory(7.2, 25, 0.01, 12, 8, 5);
  }

  createMeasurementHistory(ph: number, temp: number, no2: number, no3: number, gh: number, kh: number): void {
    const current = { label: 'Aujourd’hui', ph, temp, no2, no3, gh, kh };
    const history = [-0.4, -0.25, -0.3, -0.12, -0.08, -0.05].map((offset, index) => ({
      label: `J-${(6 - index) * 3}`, ph: Math.round((ph + offset) * 10) / 10,
      temp: Math.round((temp + [-1.2, -0.8, -0.4, -0.6, -0.2, -0.1][index]) * 10) / 10,
      no2: index < 2 ? 0.04 : 0.01, no3: 8 + index, gh: 8, kh: 5,
    }));
    this.measurement.set(current);
    this.measurements.set([...history, current]);
  }
}
