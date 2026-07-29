import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { SeoService } from '../../core/seo.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  constructor(private readonly seo: SeoService) {
    const description =
      'AquaManager est une application gratuite de gestion d’aquarium : suivi des paramètres d’eau, calendrier d’entretien, rappels, historique et assistant intelligent.';

    this.seo.apply({
      title: 'Application de gestion d’aquarium gratuite | AquaManager',
      description,
      path: '/',
      structuredData: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'SoftwareApplication',
            '@id': 'https://aquamanager.fr/#application',
            name: 'AquaManager',
            url: 'https://aquamanager.fr/',
            applicationCategory: 'LifestyleApplication',
            applicationSubCategory: 'Gestion d’aquarium',
            operatingSystem: 'Web',
            inLanguage: 'fr-FR',
            description,
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'EUR',
            },
          },
          {
            '@type': 'FAQPage',
            '@id': 'https://aquamanager.fr/#faq',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'AquaManager est-il gratuit ?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Oui. La formule Classic permet de commencer gratuitement à suivre ses aquariums, ses mesures et son entretien.',
                },
              },
              {
                '@type': 'Question',
                name: 'Quels paramètres d’aquarium puis-je suivre ?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'AquaManager permet notamment de suivre le pH, le GH, le KH, les nitrites, les nitrates et la température.',
                },
              },
              {
                '@type': 'Question',
                name: 'AquaManager remplace-t-il les tests d’eau ?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Non. Les mesures sont réalisées avec vos tests habituels ; AquaManager conserve et analyse leur historique.',
                },
              },
            ],
          },
        ],
      },
    });
  }
}
