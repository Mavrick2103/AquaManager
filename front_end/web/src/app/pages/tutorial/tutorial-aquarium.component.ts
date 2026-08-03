import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { TutorialDataService } from '../../core/tutorial-data.service';
import { MeasurementDialogComponent, TutorialMeasurementResult } from '../aquariums/detail/measurement-dialog.component';

@Component({ selector: 'app-tutorial-aquarium', standalone: true, imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule, MatTabsModule], templateUrl: './tutorial-aquarium.component.html', styleUrls: ['./tutorial-aquarium.component.scss'] })
export class TutorialAquariumComponent {
  readonly data = inject(TutorialDataService);
  readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  selectedTab = 0;

  constructor() { if (!this.data.aquarium()) void this.router.navigateByUrl('/aquariums'); }

  openMeasurementDialog(): void {
    const aquarium = this.data.aquarium();
    const ref = this.dialog.open(MeasurementDialogComponent, {
      width: '720px',
      data: {
        aquariumId: -1,
        type: aquarium?.waterType ?? 'EAU_DOUCE',
        name: aquarium?.name ?? 'Aquarium de démonstration',
        tutorial: true,
      },
    });

    ref.afterClosed().subscribe((result: TutorialMeasurementResult | false | undefined) => {
      if (!result || typeof result !== 'object' || !result.tutorial || result.ph == null || result.temp == null) return;
      this.createMeasurementHistory(
        Number(result.ph), Number(result.temp), Number(result.no2), Number(result.no3),
        Number(result.gh), Number(result.kh),
      );
    });
  }

  private createMeasurementHistory(ph: number, temp: number, no2: number, no3: number, gh: number, kh: number): void {
    const current = { label: 'Aujourd’hui', ph, temp, no2, no3, gh, kh };
    const phOffsets = [-0.4, -0.25, -0.3, -0.12, -0.08, -0.05];
    const tempOffsets = [-1.2, -0.8, -0.4, -0.6, -0.2, -0.1];
    const history = phOffsets.map((offset, index) => ({
      label: `J-${(phOffsets.length - index) * 3}`,
      ph: Math.round((current.ph + offset) * 10) / 10,
      temp: Math.round((current.temp + tempOffsets[index]) * 10) / 10,
      no2: index < 2 ? 0.04 : 0.01,
      no3: 8 + index,
      gh: 8,
      kh: 5,
    }));
    this.data.measurement.set(current);
    this.data.measurements.set([...history, current]);
  }

  phPoint(value: number, index: number): string {
    const values = this.data.measurements();
    const x = values.length <= 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 88 - ((value - 6) / 2.5) * 70;
    return `${x},${Math.max(8, Math.min(88, y))}`;
  }

  phPolyline(): string {
    return this.data.measurements().map((row, index) => this.phPoint(row.ph, index)).join(' ');
  }
}
