import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SiteTourService } from '../../core/site-tour.service';

@Component({
  selector: 'app-user-navigation', standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  template: `<nav aria-label="Mon espace AquaManager">
    <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" ariaCurrentWhenActive="page"><mat-icon aria-hidden="true">home</mat-icon>Accueil</a>
    <a routerLink="/aquariums" routerLinkActive="active" ariaCurrentWhenActive="page"><mat-icon aria-hidden="true">water_drop</mat-icon>Aquariums</a>
    <a routerLink="/calendar" routerLinkActive="active" ariaCurrentWhenActive="page"><mat-icon aria-hidden="true">event</mat-icon>Entretien</a>
    <a routerLink="/profile" routerLinkActive="active" ariaCurrentWhenActive="page"><mat-icon aria-hidden="true">tune</mat-icon>Paramètres</a>
    <button type="button" (click)="tour.open()"><mat-icon aria-hidden="true">help_outline</mat-icon>Aide</button>
  </nav>`,
  styles: [`
    :host { display:block; max-width:1100px; margin:16px auto 24px; padding:0 16px; box-sizing:border-box; scroll-margin-top:80px; }
    nav { display:flex; padding:6px; gap:6px; border:1px solid #dce9e5; border-radius:16px; background:rgba(255,255,255,.9); }
    a,button { display:flex; align-items:center; justify-content:center; gap:8px; flex:1; min-width:0; min-height:44px; border:0; border-radius:11px; background:transparent; color:#4c6970; font:inherit; font-size:.85rem; text-decoration:none; cursor:pointer; }
    a.active { color:#286b76; background:linear-gradient(120deg,#e6f3fb,#edf6e6); font-weight:700; }
    a:hover,button:hover { background:#edf6f3; }
    a:focus-visible,button:focus-visible { outline:2px solid #438ea3; outline-offset:1px; }
    mat-icon { width:20px; height:20px; font-size:20px; flex-shrink:0; }
    @media(max-width:600px) { nav { gap:2px; padding:4px; } a,button { flex-direction:column; gap:4px; padding:6px 2px; font-size:.65rem; min-height:50px; } }
  `],
})
export class UserNavigationComponent { readonly tour = inject(SiteTourService); }
