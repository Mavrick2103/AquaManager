import { Injectable, signal } from '@angular/core';

export type TutorialAquarium = { id: number; name: string; lengthCm: number; widthCm: number; heightCm: number; waterType: 'EAU_DOUCE' | 'EAU_DE_MER'; startDate: string };
export type TutorialMeasurement = { label: string; ph: number; temp: number; no2: number; no3: number; gh: number; kh: number };

@Injectable({ providedIn: 'root' })
export class TutorialDataService {
  readonly aquarium = signal<TutorialAquarium | null>(null);
  readonly measurement = signal<Record<string, unknown> | null>(null);
  readonly measurements = signal<TutorialMeasurement[]>([]);
  readonly taskCreated = signal(false);
  readonly protocolSelected = signal(false);
  readonly speciesAdded = signal(false);

  reset(): void {
    this.aquarium.set(null); this.measurement.set(null); this.measurements.set([]); this.taskCreated.set(false);
    this.protocolSelected.set(false); this.speciesAdded.set(false);
  }
}
