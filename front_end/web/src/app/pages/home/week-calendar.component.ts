import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TasksService, Task } from '../../core/tasks.service';
import { addDays, startOfWeek, addWeeks, format } from 'date-fns';
import { fr } from 'date-fns/locale';

@Component({
  selector: 'app-week-calendar',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section class="week card">
    <header class="wc-header">
      <div class="title">
        <h2>Cette semaine</h2>
        <div class="subtitle">{{ weekLabel() }}</div>
      </div>
      <div class="nav">
        <button class="nav-btn" (click)="prevWeek()" aria-label="Semaine précédente">‹</button>
        <button class="nav-btn today" (click)="goToday()">Aujourd’hui</button>
        <button class="nav-btn" (click)="nextWeek()" aria-label="Semaine suivante">›</button>
      </div>
    </header>

    <p *ngIf="loading" role="status">Chargement de la semaine…</p>
    <p *ngIf="loadError" role="alert">Impossible de charger cette semaine. <button type="button" (click)="load()">Réessayer</button></p>
    <div class="strip" *ngIf="!loading && !loadError">
      <ng-container *ngFor="let d of days">
        <div class="day">
          <div class="d">
            <div class="dow">{{ fmt(d,'EEE') }}</div>
            <div class="dom">{{ fmt(d,'d') }}</div>
          </div>

          <ul class="tasks" *ngIf="dayTasks(d).length; else empty">
            <li *ngFor="let t of dayTasks(d)" [class.task-done]="t.status === 'DONE'" [title]="t.title + (t.status === 'DONE' ? ' · Terminé' : ' · À faire')">
              <span class="dot"></span>
              <span class="txt">{{ t.title }}</span>
              <span class="done-label" *ngIf="t.status === 'DONE'">Fait</span>
              <span class="due" *ngIf="t.dueAt?.length">{{ taskTime(t) }}</span>
            </li>
          </ul>

          <ng-template #empty>
            <div class="empty">—</div>
          </ng-template>
        </div>
      </ng-container>
    </div>
  </section>
  `,
  styles: [`
    /* Carte générale (reprend ton style .card) */
    .week {
      background:#fff;
      border:1px solid rgba(0,0,0,.06);
      border-radius:16px;
      box-shadow:0 6px 20px rgba(0,0,0,.08);
      padding:1rem;
      margin-top:1rem;
    }

    /* En-tête du planning */
    .wc-header {
      display:flex; align-items:center; justify-content:space-between;
      gap:.75rem; margin-bottom:.75rem;
    }
    .title h2 {
      margin:0; font-size:1.15rem; font-weight:800; color:#1F3522;
    }
    .subtitle { font-size:.9rem; color:#4b5a54; }

    .nav { display:flex; gap:.5rem; }
    .nav-btn{
      border:1px solid rgba(0,0,0,.1); background:#fff; color:#1F3522;
      border-radius:10px; padding:.35rem .6rem; cursor:pointer;
      transition: transform .06s ease, box-shadow .06s ease, border-color .06s ease;
    }
    .nav-btn:hover{
      transform: translateY(-1px);
      box-shadow:0 4px 12px rgba(0,0,0,.06);
      border-color:#009FE3;
    }
    .nav-btn.today{ border-color:#39B54A; }

    /* Grille 7 colonnes (jours) */
    .strip{ display:grid; grid-template-columns:repeat(7,1fr); gap:.5rem; }

    .day{
      border-radius:12px; border:1px dashed rgba(0,0,0,.08); background:#fff;
      padding:.5rem; min-height:124px; display:flex; flex-direction:column; min-width:0;
    }

    .d{ display:flex; align-items:baseline; gap:.35rem; margin-bottom:.25rem; opacity:.9; }
    .dow{ font-weight:600; text-transform:capitalize; }
    .dom{ font-weight:800; color:#009FE3; }

    .tasks{ list-style:none; margin:0; padding-left:.9rem; display:grid; gap:.35rem; }
    .tasks li{
      display:grid; grid-template-columns:auto 1fr auto auto; align-items:center; gap:.4rem;
      font-size:.92rem; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }

    /* Pastille aux couleurs de ta charte */
    .dot{
      width:.5rem; height:.5rem; border-radius:50%;
      background:linear-gradient(135deg,#009FE3,#39B54A);
      box-shadow:0 0 0 2px rgba(0,0,0,.03) inset;
    }

    .txt{ overflow:hidden; text-overflow:ellipsis; }
    .tasks li.task-done { color:#547263; }
    .task-done .txt { text-decoration:line-through; }
    .done-label { font-size:.7rem; color:#34724e; }
    .due{ font-size:.8rem; color:#39B54A; }

    .empty{ opacity:.35; text-align:center; margin-top:.35rem; }

    /* Responsive pile en mobile */
    @media (max-width: 720px){
      .strip{ grid-template-columns:1fr; }
    }
  `]
})
export class WeekCalendarComponent {
  private api = inject(TasksService);

  tasks: Task[] = [];
  start = startOfWeek(new Date(), { weekStartsOn: 1 });
  days = Array.from({ length: 7 }, (_, i) => addDays(this.start, i));

  loading = true;
  loadError = false;
  private request = 0;
  constructor() { void this.load(); }
  async load() {
    const request = ++this.request;
    this.loading = true; this.loadError = false;
    try {
      const tasks = await this.api.listWindow(this.days[0],this.days[6]);
      if (request === this.request) this.tasks = tasks;
    } catch { if (request === this.request) this.loadError = true; }
    finally { if (request === this.request) this.loading = false; }
  }
  taskTime(task: Task) { return format(new Date(task.dueAt),'HH:mm'); }

  fmt(d: Date, p: string) { return format(d, p, { locale: fr }); }

  weekLabel() {
    const a = this.days[0], b = this.days[6];
    return `${this.fmt(a,'d MMM')} — ${this.fmt(b,'d MMM yyyy')}`;
  }

  prevWeek(){
    this.start = addWeeks(this.start, -1);
    this.days = Array.from({ length: 7 }, (_, i) => addDays(this.start, i));
    void this.load();
  }
  nextWeek(){
    this.start = addWeeks(this.start, 1);
    this.days = Array.from({ length: 7 }, (_, i) => addDays(this.start, i));
    void this.load();
  }
  goToday(){
    this.start = startOfWeek(new Date(), { weekStartsOn: 1 });
    this.days = Array.from({ length: 7 }, (_, i) => addDays(this.start, i));
    void this.load();
  }

  dayTasks(d: Date): Task[] {
    const iso = this.fmt(d, 'yyyy-MM-dd');
    return this.tasks.filter(t => t.dueAt && format(new Date(t.dueAt),'yyyy-MM-dd') === iso);
  }
}
