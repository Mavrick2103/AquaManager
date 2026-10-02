import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
interface SurveyStatus {
  segment: string;
  prompt: boolean;
  canSubmit: boolean;
  nextResponseAt: string | null;
}
@Component({
  selector: 'app-satisfaction',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './satisfaction.component.html',
  styleUrl: './satisfaction.component.scss',
})
export class SatisfactionComponent implements OnInit, OnDestroy {
  private destroyed = false;
  ngOnDestroy() { this.destroyed = true; }
  @Input() manual = false;
  @ViewChild('surveyDialog') dialog?: ElementRef<HTMLDialogElement>;
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private url = environment.apiUrl + '/satisfaction';
  status: SurveyStatus | null = null;
  open = false;
  expanded = false;
  busy = false;
  sent = false;
  error = '';
  rating = 0;
  premiumRating = 0;
  comment = '';
  readonly choices = [
    { value: 1, face: '😞', label: 'Très déçu' },
    { value: 2, face: '🙁', label: 'Déçu' },
    { value: 3, face: '😐', label: 'Moyen' },
    { value: 4, face: '🙂', label: 'Satisfait' },
    { value: 5, face: '😍', label: 'Très satisfait' },
  ];
  async ngOnInit() {
    if (!this.manual) await this.load(true);
  }
  async load(visit = false) {
    this.sent = false;
    this.busy = true;
    this.error = '';
    try {
      this.status = await firstValueFrom(
        visit
          ? this.http.post<SurveyStatus>(this.url + '/visit', {})
          : this.http.get<SurveyStatus>(this.url),
      );
      this.open = this.manual || this.status.prompt;
      this.expanded = true;
    } catch {
      if (this.manual) {
        this.open = true;
        this.error = 'Impossible de charger le questionnaire. Réessaie dans un instant.';
      }
    } finally {
      this.busy = false;
      if (!this.destroyed) {
        this.cdr.detectChanges();
        if (this.open && this.dialog && !this.dialog.nativeElement.open) this.dialog.nativeElement.showModal();
      }
    }
  }
  async submit() {
    if (
      !this.rating ||
      !this.status ||
      this.busy ||
      (this.status.segment === 'PREMIUM' && !this.premiumRating)
    )
      return;
    this.busy = true;
    this.error = '';
    try {
      await firstValueFrom(
        this.http.post(this.url, {
          rating: this.rating,
          comment: this.comment,
          ...(this.status.segment === 'PREMIUM' ? { premiumRating: this.premiumRating } : {}),
        }),
      );
      this.sent = true;
    } catch (e: any) {
      this.error =
        e.status === 409
          ? 'Tu as déjà donné ton avis. Tu pourras répondre à nouveau un mois après ta dernière réponse.'
          : 'Ton avis n’a pas pu être enregistré. Réessaie.';
    } finally {
      this.busy = false;
    }
  }
  async later() {
    if (this.busy) return;
    if (this.manual || this.sent) {
      this.open = false;
      return;
    }
    this.busy = true;
    try {
      await firstValueFrom(this.http.post(this.url + '/dismiss', {}));
      this.open = false;
    } catch {
      this.error = 'Impossible de reporter le questionnaire. Réessaie.';
    } finally {
      this.busy = false;
    }
  }
}
