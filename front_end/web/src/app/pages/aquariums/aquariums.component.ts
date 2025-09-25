import { MatDialog } from '@angular/material/dialog';
import { AquariumDialogComponent } from './dialog/aquarium-dialog.component';
import { AquariumsService, Aquarium } from '../../core/aquariums.service';
import { firstValueFrom } from 'rxjs';

export class AquariumsComponent {
  items: Aquarium[] = [];
  loading = false;

  constructor(private dialog: MatDialog, private api: AquariumsService) {}

  ngOnInit() { this.load(); }

  async load() {
    this.loading = true;
    this.items = await firstValueFrom(this.api.list());
    this.loading = false;
  }

  openCreate() {
    const ref = this.dialog.open(AquariumDialogComponent, { width: '720px', autoFocus: false });
    ref.afterClosed().subscribe((ok) => { if (ok) this.load(); }); // ✅ refresh liste
  }
}
