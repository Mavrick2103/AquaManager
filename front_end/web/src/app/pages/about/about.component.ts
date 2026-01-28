import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Inject, Renderer2 } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  private readonly jsonLdId = 'jsonld-faq-about';

  constructor(
    private readonly title: Title,
    private readonly meta: Meta,
    private readonly renderer: Renderer2,
    @Inject(DOCUMENT) private readonly document: Document
  ) {
    this.setSeo();
    this.injectFaqJsonLd();
  }

  private setSeo(): void {
    const pageTitle =
      'AquaManager – Gestion d’aquarium simple : suivi, rappels, paramètres';
    const description =
      "AquaManager simplifie la gestion d’aquarium : suivi des paramètres (pH, GH, KH, NO2, NO3), rappels d’entretien, fiches poissons/plantes et historique pour stabiliser votre bac.";

    this.title.setTitle(pageTitle);

    this.meta.updateTag({ name: 'description', content: description });

    // Open Graph (partage)
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
  }

  private injectFaqJsonLd(): void {
    const existing = this.document.getElementById(this.jsonLdId);
    if (existing) existing.remove();

    const faqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: "AquaManager, c’est pour quel type de bac ?",
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Eau douce, bacs plantés, crevettes, communautaires : l’application est pensée pour la gestion quotidienne et la stabilité.',
          },
        },
        {
          '@type': 'Question',
          name: 'Quels paramètres puis-je suivre ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Typiquement : pH, GH, KH, NO2, NO3, température, avec la possibilité d’étendre selon ton modèle de données.',
          },
        },
        {
          '@type': 'Question',
          name: "Est-ce que l’application remplace les tests en gouttes ?",
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Non. Tu mesures avec tes tests, l’app organise l’historique et t’aide à exploiter tes données.',
          },
        },
      ],
    };

    const script = this.renderer.createElement('script');
    script.id = this.jsonLdId;
    script.type = 'application/ld+json';
    script.text = JSON.stringify(faqJsonLd);

    this.renderer.appendChild(this.document.head, script);
  }
}
