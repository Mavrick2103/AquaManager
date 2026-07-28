import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  EventEmitter,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { Chart, ChartConfiguration, ChartDataset, Plugin, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { TargetRange } from '../../../../core/aquarium-targets.service';

Chart.register(...registerables);

export type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER';
export type MetricKey =
  | 'ph'
  | 'temp'
  | 'no2'
  | 'no3'
  | 'kh'
  | 'gh'
  | 'co2'
  | 'dkh'
  | 'salinity'
  | 'ca'
  | 'mg'
  | 'po4'
  | 'fe'
  | 'k'
  | 'sio2'
  | 'nh3';

export type MeasurementRow = {
  measuredAt: string;
  ph?: number | null;
  temp?: number | null;
  no2?: number | null;
  no3?: number | null;
  kh?: number | null;
  gh?: number | null;
  po4?: number | null;
  fe?: number | null;
  k?: number | null;
  sio2?: number | null;
  nh3?: number | null;
  dkh?: number | null;
  salinity?: number | null;
  ca?: number | null;
  mg?: number | null;
};

export type MaintenanceEvent = {
  id: string;
  title: string;
  description?: string;
  date: string;
  type: 'WATER_CHANGE' | 'FERTILIZATION' | 'TRIM' | 'WATER_TEST' | 'OTHER';
};

@Component({
  selector: 'app-water-measurements-chart',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss'],
})
export class WaterMeasurementsChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) aquariumId!: number;
  @Input({ required: true }) waterType!: WaterType;
  @Input() metric?: MetricKey;
  @Input() measurements: MeasurementRow[] = [];
  @Input() events: MaintenanceEvent[] = [];
  @Input() showEvents = true;
  @Input() periodDays = 30;
  @Input() target: TargetRange | null = null;
  @Input() interactive = false;
  @Output() detailsRequested = new EventEmitter<void>();

  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  loading = false;
  hasData = false;
  latestValue: number | null = null;
  variation: number | null = null;
  latestDate: Date | null = null;
  status: 'ok' | 'warning' | 'unknown' = 'unknown';
  visibleEvents: MaintenanceEvent[] = [];

  private viewReady = false;
  private chart?: Chart<'line', (number | null)[], Date>;

  private readonly META: Record<MetricKey, { label: string; unit: string }> = {
    ph: { label: 'pH', unit: '' },
    temp: { label: 'Température', unit: '°C' },
    no2: { label: 'NO₂', unit: 'mg/L' },
    no3: { label: 'NO₃', unit: 'mg/L' },
    kh: { label: 'KH', unit: '°d' },
    gh: { label: 'GH', unit: '°d' },
    co2: { label: 'CO₂ estimé', unit: 'mg/L' },
    dkh: { label: 'dKH', unit: '' },
    salinity: { label: 'Salinité', unit: 'ppt' },
    ca: { label: 'Calcium', unit: 'mg/L' },
    mg: { label: 'Magnésium', unit: 'mg/L' },
    po4: { label: 'PO₄', unit: 'mg/L' },
    fe: { label: 'Fer', unit: 'mg/L' },
    k: { label: 'Potassium', unit: 'mg/L' },
    sio2: { label: 'Silicates', unit: 'mg/L' },
    nh3: { label: 'Ammoniaque', unit: 'mg/L' },
  };

  get metricLabel(): string {
    return this.metric ? this.META[this.metric].label : '';
  }

  get metricUnit(): string {
    return this.metric ? this.META[this.metric].unit : '';
  }

  get variationLabel(): string {
    if (this.variation === null) return 'Pas encore de comparaison';
    if (Math.abs(this.variation) < 0.001) return 'Stable depuis la dernière mesure';

    const sign = this.variation > 0 ? '+' : '';
    return `${sign}${this.formatValue(this.variation)} depuis la dernière mesure`;
  }

  get statusLabel(): string {
    if (this.status === 'ok') return 'Dans l’objectif';
    if (this.status === 'warning') return 'Hors objectif';
    if (this.targetLabel) return this.hasData ? 'À évaluer' : 'Objectif configuré';
    return 'Objectif non défini';
  }

  get targetLabel(): string {
    const min = this.target?.min;
    const max = this.target?.max;

    if (min == null && max == null) return '';
    if (min != null && max != null) return `${min} à ${max}`;
    if (min != null) return `≥ ${min}`;
    return `≤ ${max}`;
  }

  get latestDateLabel(): string {
    if (!this.latestDate) return '';

    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(this.latestDate);
  }

  requestDetails(): void {
    if (this.interactive) this.detailsRequested.emit();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderChart(this.measurements);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['aquariumId'] ||
      changes['waterType'] ||
      changes['metric'] ||
      changes['measurements'] ||
      changes['events'] ||
      changes['showEvents'] ||
      changes['periodDays'] ||
      changes['target']
    ) {
      this.renderChart(this.measurements);
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  formatValue(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '—';

    return new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 2,
    }).format(value);
  }

  private computeCo2(ph?: number | null, kh?: number | null): number | null {
    if (ph == null || kh == null) return null;

    const value = 3 * kh * Math.pow(10, 7 - ph);
    return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
  }

  private miniOptions(metric?: MetricKey): ChartConfiguration<'line'>['options'] {
    const unit = metric ? this.META[metric].unit : '';

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          callbacks: {
            label: context =>
              `${this.metricLabel} : ${this.formatValue(Number(context.parsed.y))}${
                unit ? ` ${unit}` : ''
              }`,
          },
        },
      },
      elements: {
        point: {
          radius: 0,
          hoverRadius: 5,
        },
      },
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: {
          type: 'time',
          display: true,
          time: { unit: 'day', tooltipFormat: 'dd/MM/yyyy HH:mm' },
          ticks: { maxTicksLimit: 4, autoSkip: true, font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,.06)' },
        },
        y: {
          type: 'linear',
          display: true,
          suggestedMin: this.target?.min ?? undefined,
          suggestedMax: this.target?.max ?? undefined,
          ticks: { maxTicksLimit: 4, font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,.06)' },
          title: { display: !!unit, text: unit },
        },
      },
      layout: { padding: { top: 2, bottom: 2, left: 2, right: 2 } },
    };
  }

  private renderChart(rows: MeasurementRow[]): void {
    if (!this.viewReady) return;

    const cutoff =
      this.periodDays > 0 ? Date.now() - this.periodDays * 24 * 60 * 60 * 1000 : null;
    const data = [...(rows ?? [])]
      .filter(row => cutoff === null || new Date(row.measuredAt).getTime() >= cutoff)
      .sort((a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt));
    this.visibleEvents = [...(this.events ?? [])]
      .filter(event => cutoff === null || new Date(event.date).getTime() >= cutoff)
      .sort((a, b) => +new Date(a.date) - +new Date(b.date));
    const labels = data.map(row => new Date(row.measuredAt));
    const get = (key: keyof MeasurementRow) =>
      data.map(row => (row[key] as number | undefined) ?? null);

    const values: Partial<Record<MetricKey, (number | null)[]>> = {
      ph: get('ph'),
      temp: get('temp'),
      no2: get('no2'),
      no3: get('no3'),
      kh: get('kh'),
      gh: get('gh'),
      co2:
        this.waterType === 'EAU_DOUCE'
          ? data.map(row => this.computeCo2(row.ph, row.kh))
          : [],
      dkh: get('dkh'),
      salinity: get('salinity'),
      ca: get('ca'),
      mg: get('mg'),
      po4: get('po4'),
      fe: get('fe'),
      k: get('k'),
      sio2: get('sio2'),
      nh3: get('nh3'),
    };

    const colors: Record<MetricKey, string> = {
      ph: '#2196f3',
      temp: '#e91e63',
      no2: '#ff9800',
      no3: '#d4a800',
      kh: '#009688',
      gh: '#9c27b0',
      co2: '#607d8b',
      dkh: '#673ab7',
      salinity: '#795548',
      ca: '#4caf50',
      mg: '#689f38',
      po4: '#f44336',
      fe: '#b78916',
      k: '#494646',
      sio2: '#9b8f00',
      nh3: '#d65d5d',
    };

    const metric = this.metric;
    const series = metric ? (values[metric] ?? []) : [];
    const populated = series
      .map((value, index) => ({ value, date: labels[index] }))
      .filter((row): row is { value: number; date: Date } => row.value != null);

    this.hasData = populated.length > 0;
    this.latestValue = populated.at(-1)?.value ?? null;
    this.latestDate = populated.at(-1)?.date ?? null;
    this.variation =
      populated.length >= 2
        ? Number((populated.at(-1)!.value - populated.at(-2)!.value).toFixed(2))
        : null;
    this.status = this.resolveStatus(this.latestValue);

    this.chart?.destroy();

    const context = this.canvas?.nativeElement?.getContext('2d');
    if (!context || !labels.length || !this.hasData) return;

    const dataset: ChartDataset<'line', (number | null)[]> = {
      label: this.metricLabel + (this.metricUnit ? ` (${this.metricUnit})` : ''),
      data: series,
      borderColor: metric ? colors[metric] : '#2196f3',
      backgroundColor: 'transparent',
      pointRadius: 0,
      pointHoverRadius: 5,
      borderWidth: 2,
      tension: 0.32,
      spanGaps: true,
      yAxisID: 'y',
    };

    this.chart = new Chart<'line', (number | null)[], Date>(context, {
      type: 'line',
      data: { labels, datasets: [dataset] },
      options: this.miniOptions(metric),
      plugins: [
        this.createTargetBandPlugin(),
        ...(this.showEvents ? [this.createMaintenanceEventsPlugin()] : []),
      ],
    });
  }

  private resolveStatus(value: number | null): 'ok' | 'warning' | 'unknown' {
    if (value === null || !this.target) return 'unknown';

    const { min, max } = this.target;
    if (min == null && max == null) return 'unknown';
    if (min != null && value < min) return 'warning';
    if (max != null && value > max) return 'warning';
    return 'ok';
  }

  private createTargetBandPlugin(): Plugin<'line'> {
    const target = this.target;

    return {
      id: `target-band-${this.metric ?? 'metric'}`,
      beforeDatasetsDraw: chart => {
        if (!target || (target.min == null && target.max == null)) return;

        const y = chart.scales['y'];
        const area = chart.chartArea;
        if (!y || !area) return;

        const topValue = target.max ?? y.max;
        const bottomValue = target.min ?? y.min;
        const top = Math.max(area.top, Math.min(area.bottom, y.getPixelForValue(topValue)));
        const bottom = Math.max(area.top, Math.min(area.bottom, y.getPixelForValue(bottomValue)));

        const context = chart.ctx;
        context.save();
        context.fillStyle = 'rgba(57, 181, 74, 0.11)';
        context.fillRect(
          area.left,
          Math.min(top, bottom),
          area.right - area.left,
          Math.abs(bottom - top),
        );
        context.restore();
      },
    };
  }

  private createMaintenanceEventsPlugin(): Plugin<'line'> {
    const events = this.visibleEvents;
    let hoveredEvent: MaintenanceEvent | null = null;

    return {
      id: `maintenance-events-${this.metric ?? 'metric'}`,
      afterDatasetsDraw: chart => {
        const x = chart.scales['x'];
        const area = chart.chartArea;
        if (!x || !area || !events.length) return;

        events.forEach(event => {
          const pixel = x.getPixelForValue(new Date(event.date).getTime());
          if (!Number.isFinite(pixel) || pixel < area.left || pixel > area.right) return;

          const context = chart.ctx;
          context.save();
          context.strokeStyle = 'rgba(0, 126, 145, 0.55)';
          context.fillStyle = '#087f8c';
          context.lineWidth = 1.5;
          context.setLineDash([4, 4]);
          context.beginPath();
          context.moveTo(pixel, area.top + 8);
          context.lineTo(pixel, area.bottom);
          context.stroke();
          context.setLineDash([]);
          context.beginPath();
          context.arc(pixel, area.top + 7, 4, 0, Math.PI * 2);
          context.fill();
          context.restore();
        });

        if (!hoveredEvent) return;

        const eventX = x.getPixelForValue(new Date(hoveredEvent.date).getTime());
        if (!Number.isFinite(eventX) || eventX < area.left || eventX > area.right) return;

        const context = chart.ctx;
        const width = Math.min(230, area.right - area.left);
        const hasDescription = !!hoveredEvent.description?.trim();
        const height = hasDescription ? 82 : 64;
        const left = Math.max(
          area.left,
          Math.min(area.right - width, eventX - width / 2),
        );
        const top = Math.min(area.bottom - height, area.top + 14);

        context.save();
        context.fillStyle = 'rgba(31, 53, 34, 0.96)';
        context.shadowColor = 'rgba(0, 0, 0, 0.18)';
        context.shadowBlur = 10;
        context.beginPath();
        context.roundRect(left, top, width, height, 9);
        context.fill();
        context.shadowBlur = 0;

        context.fillStyle = '#8ee7f0';
        context.font = '700 10px Montserrat, sans-serif';
        context.fillText(this.eventTypeLabel(hoveredEvent.type), left + 11, top + 16);

        context.fillStyle = '#ffffff';
        context.font = '700 11px Montserrat, sans-serif';
        context.fillText(this.truncateText(context, hoveredEvent.title, width - 22), left + 11, top + 34);

        context.fillStyle = 'rgba(255, 255, 255, 0.72)';
        context.font = '10px Montserrat, sans-serif';
        const date = new Intl.DateTimeFormat('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(hoveredEvent.date));
        context.fillText(date, left + 11, top + 50);

        if (hasDescription) {
          context.fillText(
            this.truncateText(context, hoveredEvent.description!, width - 22),
            left + 11,
            top + 68,
          );
        }
        context.restore();
      },
      afterEvent: (chart, args) => {
        const x = chart.scales['x'];
        const area = chart.chartArea;
        const mouseX = args.event.x;
        const mouseY = args.event.y;
        const previous = hoveredEvent;

        hoveredEvent =
          mouseX == null ||
          mouseY == null ||
          mouseY < area.top ||
          mouseY > area.bottom
            ? null
            : (events.find(event => {
                const eventX = x.getPixelForValue(new Date(event.date).getTime());
                return Math.abs(eventX - mouseX) <= 7;
              }) ?? null);

        if (hoveredEvent && mouseX != null && mouseY != null) {
          chart.tooltip?.setActiveElements([], { x: mouseX, y: mouseY });
        }

        chart.canvas.style.cursor = hoveredEvent ? 'help' : '';
        if (previous?.id !== hoveredEvent?.id) {
          args.changed = true;
        }
      },
    };
  }

  private eventTypeLabel(type: MaintenanceEvent['type']): string {
    if (type === 'WATER_CHANGE') return "CHANGEMENT D'EAU";
    if (type === 'FERTILIZATION') return 'FERTILISATION';
    if (type === 'TRIM') return 'TAILLE / ENTRETIEN';
    if (type === 'WATER_TEST') return "TEST DE L'EAU";
    return 'ENTRETIEN';
  }

  private truncateText(
    context: CanvasRenderingContext2D,
    value: string,
    maxWidth: number,
  ): string {
    if (context.measureText(value).width <= maxWidth) return value;

    let shortened = value;
    while (shortened.length > 1 && context.measureText(`${shortened}…`).width > maxWidth) {
      shortened = shortened.slice(0, -1);
    }
    return `${shortened}…`;
  }
}
