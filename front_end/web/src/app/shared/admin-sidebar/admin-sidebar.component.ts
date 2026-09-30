import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'aside[appAdminSidebar]',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './admin-sidebar.component.html',
  styleUrl: './admin-sidebar.component.scss',
})
export class AdminSidebarComponent {
  @Input() adminAccess = true;
  expanded = false;
  readonly groups = [
    {
      label: 'Pilotage',
      adminOnly: true,
      links: [
        { label: 'Vue d’ensemble', icon: 'space_dashboard', route: '/admin/metrics' },
        { label: 'Utilisateurs', icon: 'group', route: '/admin/users' },
        { label: 'Abonnements', icon: 'credit_card', route: '/admin/subscriptions' },
      ],
    },
    {
      label: 'Contenus',
      adminOnly: false,
      links: [
        { label: 'Articles & conseils', icon: 'article', route: '/admin/articles' },
        { label: 'Poissons', icon: 'set_meal', route: '/admin/species/fish' },
        { label: 'Plantes', icon: 'eco', route: '/admin/species/plant' },
      ],
    },
    {
      label: 'Communication',
      adminOnly: true,
      links: [
        { label: 'Réseaux & contenus', icon: 'campaign', route: '/admin/marketing' },
        { label: 'Emails', icon: 'mail_outline', route: '/admin/emailing' },
      ],
    },
    {
      label: 'Technique',
      adminOnly: true,
      links: [{ label: 'Serveur & journaux', icon: 'dns', route: '/admin/operations' }],
    },
  ];
}
