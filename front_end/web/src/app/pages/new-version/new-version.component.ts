import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-new-version',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
  ],
  templateUrl: './new-version.component.html',
  styleUrl: './new-version.component.scss',
})
export class NewVersionComponent {}