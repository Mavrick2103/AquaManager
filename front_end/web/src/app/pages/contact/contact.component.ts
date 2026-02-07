import { Component, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Location } from '@angular/common';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

type CategoryValue = 'BUG' | 'QUESTION' | 'SUGGESTION' | 'AUTRE';

@Component({
  selector: 'app-contact',
  standalone: true,
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss'],
  imports: [
    CommonModule,
    DecimalPipe,
    ReactiveFormsModule,

    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
})
export class ContactComponent {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly location = inject(Location);

  readonly maxFiles = 5;
  readonly maxTotalMb = 10;

  readonly categories: Array<{ value: CategoryValue; label: string; icon: string }> = [
    { value: 'BUG', label: 'Problème / Bug', icon: 'bug_report' },
    { value: 'QUESTION', label: 'Question', icon: 'help' },
    { value: 'SUGGESTION', label: "Suggestion d'amélioration", icon: 'lightbulb' },
    { value: 'AUTRE', label: 'Autre', icon: 'more_horiz' },
  ];

  loading = false;
  successMsg = '';
  errorMsg = '';

  form = this.fb.group({
    category: this.fb.nonNullable.control<CategoryValue>('QUESTION', [Validators.required]),
    fromEmail: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.email,
      Validators.maxLength(120),
    ]),
    subject: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.minLength(4),
      Validators.maxLength(120),
    ]),
    message: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.minLength(20),
      Validators.maxLength(4000),
    ]),
  });

  files: File[] = [];

  goBack(): void {
    this.location.back();
  }

  // --- Files ---
  onPickFiles(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files?.length) return;

    const incoming = Array.from(input.files);

    for (const f of incoming) {
      if (this.files.length >= this.maxFiles) break;
      this.files.push(f);
    }

    // reset input pour pouvoir reprendre le même fichier
    input.value = '';
  }

  removeFile(i: number) {
    this.files.splice(i, 1);
  }

  totalSizeMb(): number {
    const bytes = this.files.reduce((acc, f) => acc + (f.size ?? 0), 0);
    return bytes / 1024 / 1024;
  }

  // --- Submit ---
  submit() {
    this.errorMsg = '';
    this.successMsg = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMsg = 'Remplis correctement les champs avant d’envoyer.';
      return;
    }

    if (this.totalSizeMb() > this.maxTotalMb) {
      this.errorMsg = `Taille totale trop grande (max ${this.maxTotalMb} MB).`;
      return;
    }

    const fd = new FormData();
    const v = this.form.getRawValue();

    fd.append('category', v.category);
    fd.append('fromEmail', v.fromEmail);
    fd.append('subject', v.subject);
    fd.append('message', v.message);

    for (const f of this.files) {
      fd.append('attachments', f, f.name);
    }

    this.loading = true;
    const url = `${environment.apiUrl}/contact`;

    this.http.post<{ ok: true }>(url, fd).subscribe({
      next: () => {
        this.loading = false;
        this.successMsg = 'Message envoyé. Merci !';

        setTimeout(() => this.location.back(), 2000);
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg =
          err?.error?.message || "Impossible d'envoyer le message. Réessaie plus tard.";
      },
    });
  }
}
