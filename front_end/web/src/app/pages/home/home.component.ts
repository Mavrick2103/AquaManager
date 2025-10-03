import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService, Me } from '../../core/auth.service';
import { WeekCalendarComponent } from './week-calendar.component';

/* Angular Material */
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule }  from '@angular/material/button';
import { MatIconModule }    from '@angular/material/icon';
import { MatCardModule }    from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule }   from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatToolbarModule, MatButtonModule, MatIconModule,
    MatCardModule, MatDividerModule, MatChipsModule,
    MatTooltipModule, MatMenuModule, WeekCalendarComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  private auth = inject(AuthService);
  me: Me | null = null;

  private openTimer: any;
  private closeTimer: any;

  async ngOnInit() {
    this.me = await this.auth.fetchMe();
  }

  logout() { this.auth.logout(); }

  openMenu(trigger: MatMenuTrigger) {
    clearTimeout(this.closeTimer);
    this.openTimer = setTimeout(() => trigger.openMenu(), 100);
  }

  keepOpen(_trigger: MatMenuTrigger) {
    clearTimeout(this.closeTimer);
  }

  closeMenu(trigger: MatMenuTrigger) {
    clearTimeout(this.openTimer);
    this.closeTimer = setTimeout(() => trigger.closeMenu(), 150);
  }
}
