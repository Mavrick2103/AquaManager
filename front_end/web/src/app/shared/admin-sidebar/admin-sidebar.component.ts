import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

type AdminLink = {
  label: string;
  description: string;
  icon: string;
  route: string;
  adminOnly?: boolean;
};

@Component({
  selector: 'aside[appAdminSidebar]',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  templateUrl: './admin-sidebar.component.html',
  styleUrl: './admin-sidebar.component.scss',
})
export class AdminSidebarComponent {
  @Input() adminAccess = true;

  readonly pilotage: AdminLink[] = [
    { label: 'Vue d’ensemble', description: 'Activité et alertes', icon: 'space_dashboard', route: '/admin/metrics', adminOnly: true },
    { label: 'Utilisateurs', description: 'Comptes, rôles et accès', icon: 'group', route: '/admin/users', adminOnly: true },
  ];

  readonly content: AdminLink[] = [
    { label: 'Poissons', description: 'Fiches et modération', icon: 'set_meal', route: '/admin/species/fish' },
    { label: 'Plantes', description: 'Catalogue végétal', icon: 'eco', route: '/admin/species/plant' },
    { label: 'Articles & conseils', description: 'Rédaction et publication', icon: 'article', route: '/admin/articles' },
  ];

  readonly communication: AdminLink[] = [
    { label: 'Communication', description: 'Contenus et réseaux', icon: 'campaign', route: '/admin/marketing', adminOnly: true },
    { label: 'Emails', description: 'Ciblage et envois manuels', icon: 'forward_to_inbox', route: '/admin/emailing', adminOnly: true },
  ];

  visible(links: AdminLink[]): AdminLink[] {
    return links.filter((link) => !link.adminOnly || this.adminAccess);
  }
}
