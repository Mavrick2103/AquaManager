import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/* Angular Material */
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';

import { AquariumsService, Aquarium } from '../../core/aquariums.service';
import { firstValueFrom } from 'rxjs';
// ❌ NE PAS importer AquariumDialogComponent ici (pas utilisé dans le template)

/**
 * Page "Mes aquariums"
 */
@Component({
  selector: 'app-aquariums',
  standalone: true,
  imports: [
    CommonModule,

    // Material utilisés dans le TEMPLATE
    MatDialogModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatButtonModule,
  ],
  templateUrl: './aquariums.component.html',
  styleUrls: ['./aquariums.component.scss'],
})
export class AquariumsComponent {
  items: Aquarium[] = [];
  loading = false;

  constructor(private dialog: MatDialog, private api: AquariumsService) {}

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading = true;
    this.items = await firstValueFrom(this.api.list());
    this.loading = false;
  }

  // Appelé depuis le template
  litersOf(a: Aquarium): number {
    // (L × l × h) cm³  → litres (÷1000), arrondi
    return Math.round((a.lengthCm * a.widthCm * a.heightCm) / 1000);
  }

  openCreate() {
    // Lazy import pour le dialog standalone (pas besoin de l'avoir dans imports)
    import('./dialog/aquarium-dialog.component').then(m => {
      const ref = this.dialog.open(m.AquariumDialogComponent, {
        width: '720px',
        autoFocus: false,
      });
      ref.afterClosed().subscribe(ok => {
        if (ok) this.load();
      });
    });
  }
}
