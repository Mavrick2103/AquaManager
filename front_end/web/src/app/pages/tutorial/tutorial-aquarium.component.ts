import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { TutorialDataService } from '../../core/tutorial-data.service';
import { SiteTourService } from '../../core/site-tour.service';

@Component({ selector: 'app-tutorial-aquarium', standalone: true, imports: [CommonModule, MatButtonModule, MatIconModule, MatTabsModule], templateUrl: './tutorial-aquarium.component.html', styleUrls: ['./tutorial-aquarium.component.scss'] })
export class TutorialAquariumComponent {
  readonly data = inject(TutorialDataService);
  readonly tour = inject(SiteTourService);
  selectedTab = 0;

  constructor() {
    this.data.prepareStep('aquarium');
    effect(() => {
      const step = this.tour.steps[this.tour.step()];
      if (this.tour.opened() && step.demoTab != null) this.selectedTab = step.demoTab;
    });
  }

  completeTask(): void { this.data.taskCompleted.set(true); this.tour.complete('tasks'); }
  applySolution(): void { this.data.solutionTaskCreated.set(true); this.tour.complete('solutions'); }

  phPoint(value: number, index: number): string {
    const values = this.data.measurements();
    const x = values.length <= 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 88 - ((value - 6) / 2.5) * 70;
    return `${x},${Math.max(8, Math.min(88, y))}`;
  }

  phPolyline(): string { return this.data.measurements().map((row, index) => this.phPoint(row.ph, index)).join(' '); }
}
