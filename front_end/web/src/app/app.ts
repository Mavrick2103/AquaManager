import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { APP_VERSION } from './core/app-version';
import { SiteTourComponent } from './shared/site-tour/site-tour.component';
import { AuthService } from './core/auth.service';
import { SiteTourService } from './core/site-tour.service';
import { SatisfactionComponent } from './shared/satisfaction/satisfaction.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SiteTourComponent, SatisfactionComponent],
  templateUrl: './app.html',
})
export class App {
  router = inject(Router);
  auth = inject(AuthService);
  tour = inject(SiteTourService);

  private authRoutes = ['/login', '/register', '/auth/reset-password'];
  appVersion = APP_VERSION;
  
  get hideChrome() {
    const url = this.router.url.split('?')[0];
    return this.authRoutes.some(p => url.startsWith(p));
  }
}
