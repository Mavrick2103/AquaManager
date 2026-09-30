import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-premium-launch',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  templateUrl: './premium-launch.component.html',
  styleUrl: './premium-launch.component.scss',
})
export class PremiumLaunchComponent {}
