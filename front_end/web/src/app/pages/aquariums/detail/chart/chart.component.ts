import {
  AfterViewInit, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { Chart, ChartConfiguration, ChartDataset, LegendItem, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns'; // axe temps
import { MeasurementsService, Measurement } from '../../../../core/water.service';

Chart.register(...registerables);

type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER';

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

  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  private svc = inject(MeasurementsService);

  loading = false;
  hasData = false;
  private chart?: Chart<'line', (number | null)[], Date>;

  async ngAfterViewInit() {
    await this.loadAndRender();
  }

  async ngOnChanges(ch: SimpleChanges) {
    if (ch['aquariumId'] || ch['waterType']) await this.loadAndRender();
  }

  private async loadAndRender() {
    if (!this.aquariumId) return;
    this.loading = true;
    try {
      const rows = await this.svc.listForAquarium(this.aquariumId);
      this.renderChart(rows ?? []);
    } catch (e) {
      console.warn('Erreur mesures', e);
      this.renderChart([]);
    } finally {
      this.loading = false;
    }
  }

  /** CO₂ (mg/L) ≈ 3 × KH × 10^(7 − pH) */
  private computeCo2(ph?: number | null, kh?: number | null): number | null {
    if (ph == null || kh == null) return null;
    const v = 3 * kh * Math.pow(10, 7 - ph);
    return Number.isFinite(v) ? Number(v.toFixed(2)) : null;
  }

  private renderChart(rows: Measurement[]) {
    const data = [...rows].sort((a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt));
    const labels = data.map(d => new Date(d.measuredAt));

    // données
    const ph   = data.map(d => d.ph ?? null);
    const temp = data.map(d => d.temp ?? null);
    const no2  = data.map(d => d.no2 ?? null);
    const no3  = data.map(d => d.no3 ?? null);

    // eau douce
    const kh   = data.map(d => d.kh ?? null);
    const gh   = data.map(d => d.gh ?? null);
    const co2  = this.waterType === 'EAU_DOUCE' ? data.map(d => this.computeCo2(d.ph ?? null, d.kh ?? null)) : [];

    // eau de mer
    const dkh  = data.map(d => d.dkh ?? null);
    const sal  = data.map(d => d.salinity ?? null);
    const ca   = data.map(d => d.ca ?? null);
    const mg   = data.map(d => d.mg ?? null);
    const po4  = data.map(d => d.po4 ?? null);

    this.hasData = [
      ...ph, ...temp, ...no2, ...no3,
      ...(this.waterType === 'EAU_DOUCE' ? [...kh, ...gh, ...co2] : []),
      ...(this.waterType === 'EAU_DE_MER' ? [...dkh, ...sal, ...ca, ...mg, ...po4] : []),
    ].some(v => v != null);

    // couleurs
    const C = {
      ph:   'rgba(33,150,243,.9)',
      temp: 'rgba(233,30,99,.9)',
      no2:  'rgba(255,152,0,.9)',
      no3:  'rgba(255,193,7,.9)',
      kh:   'rgba(0,150,136,.9)',
      gh:   'rgba(156,39,176,.9)',
      co2:  'rgba(158,158,158,.9)',
      dkh:  'rgba(103,58,183,.9)',
      sal:  'rgba(121,85,72,.9)',
      ca:   'rgba(76,175,80,.9)',
      mg:   'rgba(139,195,74,.9)',
      po4:  'rgba(244,67,54,.9)',
    };

    const ds = (label: string, arr: (number|null)[], axis: string, color: string, hidden = false): ChartDataset<'line', (number|null)[]> => ({
      label, data: arr, yAxisID: axis, hidden,
      borderColor: color, backgroundColor: color, pointRadius: 2, borderWidth: 2, tension: .25, spanGaps: true,
    });

    const datasets: ChartDataset<'line', (number|null)[]>[] = [
      ds('pH', ph, 'y_ph', C.ph),
      ds('Température (°C)', temp, 'y_temp', C.temp, true),

      ds('NO₂ (mg/L)', no2, 'y_mgL', C.no2, true),
      ds('NO₃ (mg/L)', no3, 'y_mgL', C.no3),

      ...(this.waterType === 'EAU_DOUCE' ? [
        ds('KH (°d)', kh, 'y_hard', C.kh),
        ds('GH (°d)', gh, 'y_hard', C.gh, true),
        ds('CO₂ (mg/L)', co2, 'y_mgL', C.co2, true),
      ] : []),

      ...(this.waterType === 'EAU_DE_MER' ? [
        ds('dKH', dkh, 'y_hard', C.dkh),
        ds('Salinité (ppt)', sal, 'y_sal', C.sal),
        ds('Calcium (mg/L)', ca, 'y_mgL_hi', C.ca),
        ds('Magnésium (mg/L)', mg, 'y_mgL_hi', C.mg, true),
        ds('PO₄ (mg/L)', po4, 'y_mgL', C.po4, true),
      ] : []),
    ];

    const cfg: ChartConfiguration<'line', (number|null)[], Date> = {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { usePointStyle: true, boxWidth: 12 },
            onClick: (e, item: LegendItem, legend) => {
              const ci = legend.chart as Chart<'line'>;
              const dataset = ci.data.datasets[item.datasetIndex!];
              (dataset as any).hidden = !(dataset as any).hidden; // toggle
              this.updateScalesVisibility(ci); // axes dynamiques
              ci.update();
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed.y;
                return v == null ? '—' : `${ctx.dataset.label}: ${v}`;
              }
            }
          },
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: 'day', tooltipFormat: 'dd/MM/yyyy HH:mm' },
            ticks: { maxRotation: 0, autoSkip: true },
            grid: { color: 'rgba(0,0,0,.06)' },
          },
          // Axes Y (on en a 5 max; on les masque/affiche dynamiquement)
          y_ph:    { type: 'linear', position: 'left',  suggestedMin: 0, suggestedMax: 14,  title: { display: true, text: 'pH' } },
          y_temp:  { type: 'linear', position: 'right', suggestedMin: 0, suggestedMax: 40,  grid: { drawOnChartArea: false }, title: { display: true, text: '°C' } },
          y_hard:  { type: 'linear', position: 'right', suggestedMin: 0, suggestedMax: 20,  grid: { drawOnChartArea: false }, title: { display: true, text: 'Dureté (°d / dKH)' } },
          y_mgL:   { type: 'linear', position: 'left',  suggestedMin: 0, suggestedMax: 50,  grid: { drawOnChartArea: false }, title: { display: true, text: 'mg/L' } },
          y_mgL_hi:{ type: 'linear', position: 'left',  suggestedMin: 0, suggestedMax: 1800,grid: { drawOnChartArea: false }, title: { display: true, text: 'mg/L (Ca/Mg)' } },
          y_sal:   { type: 'linear', position: 'right', suggestedMin: 0, suggestedMax: 45,  grid: { drawOnChartArea: false }, title: { display: true, text: 'ppt' } },
        }
      }
    };

    // (re)création
    this.chart?.destroy();
    const ctx = this.canvas?.nativeElement?.getContext('2d');
    if (!ctx) return;
    this.chart = new Chart<'line', (number|null)[], Date>(ctx, cfg);

    // axe initial selon séries visibles
    this.updateScalesVisibility(this.chart);
  }

  /** Montre seulement les axes Y utiles; si > 4 séries visibles → on cache tous les Y (on garde juste X). */
  private updateScalesVisibility(ci: Chart<'line'>) {
    const visible = ci.data.datasets.filter(ds => !(ds as any).hidden);
    const countVisible = visible.length;

    // > 4 séries visibles → cache tous les Y
    if (countVisible > 4) {
      Object.entries(ci.options.scales ?? {}).forEach(([id, scale]) => {
        (scale as any).display = (id === 'x'); // on garde juste l'axe temps
      });
      return;
    }

    // Sinon, n'affiche que les axes utilisés et non vides
    const usedAxes = new Set<string>();
    visible.forEach(ds => {
      const hasData = (ds.data as (number|null)[]).some(v => v != null);
      const axisId = (ds as any).yAxisID as string | undefined;
      if (hasData && axisId) usedAxes.add(axisId);
    });

    Object.entries(ci.options.scales ?? {}).forEach(([id, scale]) => {
      if (id === 'x') { (scale as any).display = true; return; }
      (scale as any).display = usedAxes.has(id);
    });
  }
}
