import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AquariumsService, Aquarium } from '../../core/aquariums.service';
import { firstValueFrom } from 'rxjs';
import { AquariumDialogComponent } from './dialog/aquarium-dialog.component';

@Component({
  selector: 'app-aquariums',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,

    // Angular Material utilisés dans le template
    MatDialogModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './aquariums.component.html',
  styleUrls: ['./aquariums.component.scss'],
})
export class AquariumsComponent implements OnInit {
  items: Aquarium[] = [];
  loading = false;

  constructor(
    private dialog: MatDialog,
    private api: AquariumsService,
    private router: Router
  ) {}

  ngOnInit() { this.load(); }

  async load() {
    this.loading = true;
    this.items = await firstValueFrom(this.api.list());
    this.loading = false;
  }

  openCreate() {
    const ref = this.dialog.open(AquariumDialogComponent, {
      width: '720px',
      autoFocus: false,
    });
    ref.afterClosed().subscribe(ok => { if (ok) this.load(); });
  }

  // Navigation vers la fiche
  goTo(a: Aquarium) {
    this.router.navigate(['/aquariums', a.id]);
  }

  // Utilisé dans le template (si tu préfères, remplace par a.volumeL)
  litersOf(a: Aquarium): number {
    return Math.round((a.lengthCm * a.widthCm * a.heightCm) / 1000);
  }
}
