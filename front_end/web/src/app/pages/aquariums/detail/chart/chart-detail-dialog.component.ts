import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { TargetRange } from '../../../../core/aquarium-targets.service';
import {
  MaintenanceEvent,
  MeasurementRow,
  MetricKey,
  WaterMeasurementsChartComponent,
  WaterType,
} from './chart.component';

export interface ChartDetailDialogData {
  aquariumId: number;
  waterType: WaterType;
  metric: MetricKey;
  label: string;
  measurements: MeasurementRow[];
  events: MaintenanceEvent[];
  periodDays: number;
  periodLabel: string;
  target: TargetRange | null;
}

@Component({
  selector: 'app-chart-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    WaterMeasurementsChartComponent,
  ],
  templateUrl: './chart-detail-dialog.component.html',
  styleUrl: './chart-detail-dialog.component.scss',
})
export class ChartDetailDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ChartDetailDialogData,
    private readonly ref: MatDialogRef<ChartDetailDialogComponent>,
  ) {}

  get values(): number[] {
    const cutoff =
      this.data.periodDays > 0
        ? Date.now() - this.data.periodDays * 24 * 60 * 60 * 1000
        : null;

    return this.data.measurements
      .filter(row => cutoff === null || new Date(row.measuredAt).getTime() >= cutoff)
      .map(row => this.metricValue(row))
      .filter((value): value is number => value !== null);
  }

  get count(): number {
    return this.values.length;
  }

  get periodEvents(): MaintenanceEvent[] {
    const cutoff =
      this.data.periodDays > 0
        ? Date.now() - this.data.periodDays * 24 * 60 * 60 * 1000
        : null;

    return this.data.events
      .filter(event => cutoff === null || new Date(event.date).getTime() >= cutoff)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  eventIcon(type: MaintenanceEvent['type']): string {
    if (type === 'WATER_CHANGE') return 'water_drop';
    if (type === 'FERTILIZATION') return 'eco';
    if (type === 'TRIM') return 'content_cut';
    if (type === 'WATER_TEST') return 'science';
    return 'build';
  }

  get minimum(): number | null {
    return this.values.length ? Math.min(...this.values) : null;
  }

  get maximum(): number | null {
    return this.values.length ? Math.max(...this.values) : null;
  }

  get average(): number | null {
    if (!this.values.length) return null;
    return this.values.reduce((sum, value) => sum + value, 0) / this.values.length;
  }

  get inTargetPercent(): number | null {
    const { min, max } = this.data.target ?? {};
    if (!this.values.length || (min == null && max == null)) return null;

    const inTarget = this.values.filter(
      value => (min == null || value >= min) && (max == null || value <= max),
    ).length;

    return Math.round((inTarget / this.values.length) * 100);
  }

  format(value: number | null): string {
    if (value === null) return '—';
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
  }

  close(): void {
    this.ref.close();
  }

  private metricValue(row: MeasurementRow): number | null {
    if (this.data.metric === 'co2') {
      if (row.ph == null || row.kh == null) return null;
      const value = 3 * row.kh * Math.pow(10, 7 - row.ph);
      return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
    }

    const value = row[this.data.metric as keyof MeasurementRow];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
