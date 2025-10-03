import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TasksService, Task } from '../../core/tasks.service';
import { addDays, startOfWeek, format } from 'date-fns';
import { fr } from 'date-fns/locale';

@Component({
  selector: 'app-week-calendar',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section class="week">
    <header><h2>Cette semaine</h2></header>
    <div class="strip">
      <ng-container *ngFor="let d of days">
        <div class="day">
          <div class="d">{{ fmt(d,'EEE d') }}</div>
          <ul>
            <!-- ✅ plus d’arrow function dans le template -->
            <li *ngFor="let t of dayTasks(d)">
              <span class="dot"></span> {{ t.title }}
            </li>
          </ul>
        </div>
      </ng-container>
    </div>
  </section>
  `,
  styles: [`
    .week { margin-top: 1rem; background:#fff; border:1px solid rgba(0,0,0,.06); border-radius: 12px; padding:.75rem 1rem; }
    header h2 { margin: .25rem 0 .75rem; font-size:1.1rem; }
    .strip { display:grid; grid-template-columns: repeat(7,1fr); gap:.5rem; }
    .day { border-radius:10px; border:1px dashed rgba(0,0,0,.08); padding:.5rem; min-height:84px; }
    .d { font-weight:600; margin-bottom:.25rem; opacity:.8; }
    ul { margin:0; padding-left: 1rem; }
    li { font-size:.86rem; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .dot { display:inline-block; width:.5rem; height:.5rem; border-radius:50%; background: currentColor; margin-right:.4rem; }
  `]
})
export class WeekCalendarComponent {
  private api = inject(TasksService);

  tasks: Task[] = [];
  start = startOfWeek(new Date(), { weekStartsOn: 1 });
  days = Array.from({ length: 7 }, (_, i) => addDays(this.start, i));

  constructor() {
    const monthStr = format(new Date(), 'yyyy-MM');
    this.api.list(monthStr).subscribe(res => this.tasks = res);
  }

  fmt(d: Date, p: string) { return format(d, p, { locale: fr }); }

  /** Retourne les tâches dont dueAt est le jour d (format yyyy-MM-dd) */
  dayTasks(d: Date): Task[] {
    const iso = this.fmt(d, 'yyyy-MM-dd');
    return this.tasks.filter(t => t.dueAt?.startsWith(iso));
  }
}
