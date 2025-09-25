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

  // Routes où l'on NE veut PAS de header
  private authRoutes = ['/login', '/register', '/reset-password'];

  // true => cacher le header
  get hideChrome() {
    const url = this.router.url.split('?')[0]; // sans query params
    return this.authRoutes.some(p => url.startsWith(p));
  }
}
