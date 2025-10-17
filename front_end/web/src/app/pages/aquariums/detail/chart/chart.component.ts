import {
  AfterViewInit, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { Chart, ChartConfiguration, ChartDataset, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { MeasurementsService, Measurement } from '../../../../core/water.service';

Chart.register(...registerables);

type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER';
type MetricKey = 'ph'|'temp'|'no2'|'no3'|'kh'|'gh'|'co2'|'dkh'|'sal'|'ca'|'mg'|'po4'|'fe'|'k'|'sio2'|'nh3';

@Component({
  selector: 'app-water-measurements-chart',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss'],
})
export class WaterMeasurementsChartComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) aquariumId!: number;
  @Input({ required: true }) waterType!: WaterType;
  @Input() metric?: MetricKey; // un graphe = une métrique

  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  private svc = inject(MeasurementsService);

  loading = false;
  hasData = false;
  private chart?: Chart<'line', (number | null)[], Date>;

  // Libellés + unités
  private readonly META: Record<MetricKey, {label: string; unit: string}> = {
    ph:  { label: 'pH',          unit: '' },
    temp:{ label: 'Température', unit: '°C' },
    no2: { label: 'NO₂',         unit: 'mg/L' },
    no3: { label: 'NO₃',         unit: 'mg/L' },
    kh:  { label: 'KH',          unit: '°d' },
    gh:  { label: 'GH',          unit: '°d' },
    co2: { label: 'CO₂',         unit: 'mg/L' },
    dkh: { label: 'dKH',         unit: '' },
    sal: { label: 'Salinité',    unit: 'ppt' },
    ca:  { label: 'Calcium',     unit: 'mg/L' },
    mg:  { label: 'Magnésium',   unit: 'mg/L' },
    po4: { label: 'PO₄',         unit: 'mg/L' },
    fe: { label: 'Fe',         unit: 'mg/L' },
    k: { label: 'Potassium',         unit: 'mg/L' },    
    sio2: { label: 'Silicates',         unit: 'mg/L' },    
    nh3: { label: 'Ammoniaque',         unit: 'mg/L' },
  };
  get metricLabel(): string { return this.metric ? this.META[this.metric].label : ''; }
  get metricUnit(): string  { return this.metric ? this.META[this.metric].unit  : ''; }

  async ngAfterViewInit() { await this.loadAndRender(); }
  async ngOnChanges(ch: SimpleChanges) {
    if (ch['aquariumId'] || ch['waterType'] || ch['metric']) await this.loadAndRender();
  }

  private async loadAndRender() {
    if (!this.aquariumId) return;
    this.loading = true;
    try {
      const rows = await this.svc.listForAquarium(this.aquariumId);
      this.renderChart(rows ?? []);
    } catch { this.renderChart([]); } finally { this.loading = false; }
  }

  /** CO₂ (mg/L) ≈ 3 × KH × 10^(7 − pH) */
  private computeCo2(ph?: number | null, kh?: number | null): number | null {
    if (ph == null || kh == null) return null;
    const v = 3 * kh * Math.pow(10, 7 - ph);
    return Number.isFinite(v) ? Number(v.toFixed(2)) : null;
  }

  /** Options mini AVEC axes visibles */
  private miniOptions(metric?: MetricKey): ChartConfiguration<'line'>['options'] {
    const unit = metric ? this.META[metric].unit : '';
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true, mode: 'index', intersect: false },
      },
      elements: { point: { radius: 0 } },
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: {
          type: 'time',
          display: true,
          time: { unit: 'day', tooltipFormat: 'dd/MM/yyyy' },
          ticks: { maxTicksLimit: 4, autoSkip: true, font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,.06)' },
        },
        y: {
          type: 'linear',
          display: true,
          ticks: { maxTicksLimit: 4, font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,.06)' },
          title: { display: !!unit, text: unit },
        },
      },
      layout: { padding: { top: 2, bottom: 2, left: 2, right: 2 } },
    };
  }

  private renderChart(rows: Measurement[]) {
    // Tri / labels
    const data = [...rows].sort((a,b)=>+new Date(a.measuredAt)-+new Date(b.measuredAt));
    const labels = data.map(d => new Date(d.measuredAt));

    // Valeurs par métrique
    const get = (k: keyof Measurement) => data.map(d => (d[k] as number | undefined) ?? null);
    const values: Partial<Record<MetricKey, (number | null)[]>> = {
      ph: get('ph'),
      temp: get('temp'),
      no2: get('no2'),
      no3: get('no3'),
      kh: get('kh'),
      gh: get('gh'),
      co2: this.waterType === 'EAU_DOUCE' ? data.map(d => this.computeCo2(d.ph, d.kh)) : [],
      dkh: get('dkh'),
      sal: get('salinity'),
      ca: get('ca'),
      mg: get('mg'),
      po4: get('po4'),
      fe: get('fe'),
      k: get('k'),
      sio2: get('sio2'),
      nh3: get('nh3'),
    };

    // Couleurs
    const C: Record<MetricKey, string> = {
      ph:'#2196f3', temp:'#e91e63', no2:'#ff9800', no3:'#ffc107',
      kh:'#009688', gh:'#9c27b0', co2:'#9e9e9e',
      dkh:'#673ab7', sal:'#795548', ca:'#4caf50', mg:'#8bc34a', po4:'#f44336',
      fe:'#d7ac2dff', k:'#494646ff', sio2:'#e8e830ff', nh3:'#f2a8a8ff',

    };

    // Série demandée
    const m = this.metric as MetricKey | undefined;
    const series = m ? (values[m] ?? []) : [];
    this.hasData = series.some(v => v != null);

    // (re)création
    this.chart?.destroy();
    const ctx = this.canvas?.nativeElement?.getContext('2d');
    if (!ctx || !labels.length) { this.hasData = false; return; }

    const dataset: ChartDataset<'line', (number | null)[]> = {
      label: this.metricLabel + (this.metricUnit ? ` (${this.metricUnit})` : ''),
      data: series,
      borderColor: m ? C[m] : '#2196f3',
      backgroundColor: 'transparent',
      pointRadius: 0,
      borderWidth: 2,
      tension: 0.35,
      spanGaps: true,
      yAxisID: 'y',
    };

    const cfg: ChartConfiguration<'line', (number | null)[], Date> = {
      type: 'line',
      data: { labels, datasets: [dataset] },
      options: this.miniOptions(m),
    };

    this.chart = new Chart<'line', (number | null)[], Date>(ctx, cfg);
  }
}
