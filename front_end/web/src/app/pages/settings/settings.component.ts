import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
import { SettingsService, UserSettings } from '../../core/settings.service';

// ✅ valeurs par défaut pour éviter tout "undefined"
const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  defaultView: 'cards',
  temperatureUnit: 'C',
  volumeUnit: 'L',
  emailNotifications: true,
  pushNotifications: false,
  alertsEnabled: true,
  phMin: 6.0,
  phMax: 7.5,
  tempMin: 22,
  tempMax: 26,
};

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSelectModule, MatSlideToggleModule,
    MatDividerModule, MatSnackBarModule, MatProgressSpinnerModule,
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private svc = inject(SettingsService);
  private snack = inject(MatSnackBar);

  form!: FormGroup;
  loading = false;

  // snapshot initial
  private orig!: UserSettings;

  async ngOnInit() {
    this.loading = true;
    try {
      const data = (await this.svc.getMySettings()) ?? DEFAULT_SETTINGS;
      this.orig = { ...data };

      this.form = this.fb.group({
        theme: [data.theme, [Validators.required]],
        defaultView: [data.defaultView, [Validators.required]],
        temperatureUnit: [data.temperatureUnit, [Validators.required]],
        volumeUnit: [data.volumeUnit, [Validators.required]],
        emailNotifications: [data.emailNotifications],
        pushNotifications: [data.pushNotifications],
        alertsEnabled: [data.alertsEnabled],
        phMin: [data.phMin, [Validators.min(0), Validators.max(14)]],
        phMax: [data.phMax, [Validators.min(0), Validators.max(14)]],
        tempMin: [data.tempMin, [Validators.min(0), Validators.max(40)]],
        tempMax: [data.tempMax, [Validators.min(0), Validators.max(40)]],
      }, { validators: [rangeValidator('phMin', 'phMax'), rangeValidator('tempMin', 'tempMax')] });

      // désactiver seuils si alertes off
      this.form.get('alertsEnabled')!.valueChanges.subscribe(enabled => {
        const controls = ['phMin', 'phMax', 'tempMin', 'tempMax'] as const;
        controls.forEach(name => {
          const ctrl = this.form.get(name)!;
          enabled ? ctrl.enable({ emitEvent: false }) : ctrl.disable({ emitEvent: false });
        });
      });
      if (!data.alertsEnabled) {
        ['phMin', 'phMax', 'tempMin', 'tempMax'].forEach(n => this.form.get(n)!.disable({ emitEvent: false }));
      }

    } catch (e: any) {
      this.snack.open(e?.error?.message || 'Impossible de charger vos paramètres', 'Fermer', { duration: 3500 });
    } finally {
      this.loading = false;
    }
  }

  get hasChanges(): boolean {
    if (!this.form) return false;
    const v = this.form.getRawValue() as UserSettings;
    return Object.keys(v).some(k => (v as any)[k] !== (this.orig as any)[k]);
  }

  reset() {
    if (!this.form) return;
    this.form.reset(this.orig);
    if (!this.orig.alertsEnabled) {
      ['phMin','phMax','tempMin','tempMax'].forEach(n => this.form.get(n)!.disable({ emitEvent: false }));
    }
    this.form.markAsPristine();
  }

  async save() {
  if (!this.form || this.form.invalid || !this.hasChanges) return;

  this.loading = true;
  try {
    const curr = this.form.getRawValue() as UserSettings;

    // ✅ construit diff sans assignation indexée (évite TS2322)
    const keys = Object.keys(curr) as (keyof UserSettings)[];
    const entries = keys
      .filter(k => curr[k] !== this.orig[k])
      .map(k => [k, curr[k]] as const);

    const diff = Object.fromEntries(entries) as Partial<UserSettings>;

    if (entries.length) {
      await this.svc.updateMySettings(diff);
      this.orig = { ...this.orig, ...diff };
      this.form.markAsPristine();
    }

    this.snack.open('Paramètres enregistrés ✅', 'OK', { duration: 2000 });
  } catch (e: any) {
    this.snack.open(e?.error?.message || 'Échec de l’enregistrement', 'Fermer', { duration: 3500 });
  } finally {
    this.loading = false;
  }
}

}

/** Valide que min <= max pour deux champs numériques */
function rangeValidator(minKey: string, maxKey: string) {
  return (group: AbstractControl) => {
    const min = group.get(minKey)?.value;
    const max = group.get(maxKey)?.value;
    if (min == null || max == null) return null;
    return +min <= +max ? null : { range: { [minKey]: min, [maxKey]: max } };
  };
}
