import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {
  router = inject(Router);

  private authRoutes = ['/login', '/register', '/reset-password'];

  get hideChrome() {
    const url = this.router.url.split('?')[0];
    return this.authRoutes.some(p => url.startsWith(p));
  }
}
