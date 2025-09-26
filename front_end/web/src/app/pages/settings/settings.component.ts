import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { firstValueFrom } from 'rxjs';
import { retry, delay as rxDelay, timeout } from 'rxjs/operators';

import { SettingsService, AppSettings } from '../../core/settings.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatSelectModule,
    MatSlideToggleModule, MatButtonModule, MatIconModule,
    MatSnackBarModule, MatProgressSpinnerModule
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  private api = inject(SettingsService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  loading = true;
  saving = false;

  form = this.fb.group({
    unit: ['metric' as 'metric'|'imperial'],
    theme: ['system' as 'light'|'dark'|'system'],
    language: ['fr' as 'fr'|'en'],
    notifications: [true],
  });

  async ngOnInit() {
    this.loading = true;
    try {
      // ✅ Evite le faux “impossible de charger” si un refresh token se fait en arrière-plan
      const s = await firstValueFrom(
        this.api.get().pipe(
          retry({ count: 1, delay: 200 }), // retente une fois
          rxDelay(150),                    // lisse le rendu
          timeout(8000),
        )
      );
      this.form.patchValue(s);
    } catch (err: any) {
      // si c’était un 401 temporaire, on évite d’afficher une alerte inutile
      if (err?.status !== 401) {
        this.snack.open('Impossible de charger les paramètres', 'Fermer', { duration: 3000 });
      }
      // valeurs par défaut pour éviter une page vide
      this.form.setValue({ unit:'metric', theme:'system', language:'fr', notifications:true });
    } finally {
      this.loading = false;
    }
  }

  async save() {
    this.saving = true;
    try {
      const dto: Partial<AppSettings> = { ...(this.form.getRawValue() as AppSettings) };
      await firstValueFrom(this.api.update(dto));
      this.form.markAsPristine();
      this.snack.open('Paramètres enregistrés', 'OK', { duration: 2000 });
    } catch {
      this.snack.open('Échec de l’enregistrement', 'Fermer', { duration: 3000 });
    } finally {
      this.saving = false;
    }
  }
}
