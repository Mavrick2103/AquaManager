import { Injectable, inject } from '@angular/core';
import { ResolveEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { SeoService } from './seo.service';

@Injectable({ providedIn: 'root' })
export class RouteSeoService {
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  initialize(): void {
    // Before activation: detail components can then supply their loaded metadata.
    this.router.events.pipe(filter((event): event is ResolveEnd => event instanceof ResolveEnd)).subscribe(event => {
      let route = event.state.root;
      let protectedPage = false;
      while (route.firstChild) {
        route = route.firstChild;
        protectedPage ||= !!route.routeConfig?.canActivate?.length;
      }
      const path = event.urlAfterRedirects.split(/[?#]/)[0];
      const titles: Record<string, string> = {
        '': 'Application de gestion d’aquarium gratuite', dashboard: 'Tableau de bord',
        aquariums: 'Mes aquariums', 'aquariums/:id': 'Détail de l’aquarium',
        calendar: 'Calendrier', profile: 'Profil', species: 'Poissons et plantes', contact: 'Contact',
      };
      this.seo.apply({
        title: route.data['title'] ?? `${titles[route.routeConfig?.path ?? ''] ?? 'Gestion de vos aquariums'} – AquaManager`,
        description: route.data['description'] ?? 'Suivez vos aquariums, leurs paramètres et leur entretien avec AquaManager.',
        path,
        robots: route.data['robots'] ?? (protectedPage ? 'noindex,nofollow' : 'index,follow'),
      });
    });
  }
}
