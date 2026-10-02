import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { AiApi, AiAquariumAnalysisResponse } from '../../../core/ai.service';

@Component({
  selector: 'app-ai-feedback',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="feedback" *ngIf="analysis.usageId">
      <span>Cette réponse t’a-t-elle été utile ?</span>
      <div class="choices" role="group" aria-label="Évaluer la réponse de l’IA">
        <button mat-stroked-button type="button" [disabled]="saving"
          [class.selected]="analysis.feedback === 'HELPFUL'"
          [attr.aria-pressed]="analysis.feedback === 'HELPFUL'" (click)="vote('HELPFUL')">
          <mat-icon>thumb_up</mat-icon> Utile
        </button>
        <button mat-stroked-button type="button" [disabled]="saving"
          [class.selected]="analysis.feedback === 'NOT_HELPFUL'"
          [attr.aria-pressed]="analysis.feedback === 'NOT_HELPFUL'" (click)="vote('NOT_HELPFUL')">
          <mat-icon>thumb_down</mat-icon> Hors sujet / pas utile
        </button>
      </div>
      <small role="status">{{ saving ? 'Enregistrement…' : error || (analysis.feedback ? 'Merci ! Ton avis est enregistré. Tu peux le modifier.' : '') }}</small>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .feedback { margin-top: 16px; padding-top: 12px; border-top: 1px solid #dce5e4; white-space: normal; font-size: 14px; }
    .choices { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
    button.selected { background: #e0eeea; border-color: #405f5b; color: #284c46; }
    small { display: block; }
  `],
})
export class AiFeedbackComponent {
  @Input({ required: true }) analysis!: AiAquariumAnalysisResponse;
  private readonly api = inject(AiApi);
  saving = false;
  error = '';

  async vote(feedback: 'HELPFUL' | 'NOT_HELPFUL') {
    if (this.saving || this.analysis.feedback === feedback) return;
    this.saving = true;
    this.error = '';
    try {
      const result = await firstValueFrom(this.api.saveFeedback(this.analysis.usageId, feedback));
      this.analysis.feedback = result.feedback;
    } catch {
      this.error = 'Avis non enregistré. Réessaie dans un instant.';
    } finally {
      this.saving = false;
    }
  }
}
