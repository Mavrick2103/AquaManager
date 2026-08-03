import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { TutorialDataService } from './tutorial-data.service';

export type GuidedTourStep = {
  route: string;
  selector?: string;
  icon: string;
  title: string;
  description: string;
  instruction?: string;
  waitForTargetClick?: boolean;
  advanceManually?: boolean;
};

@Injectable({ providedIn: 'root' })
export class SiteTourService {
  readonly opened = signal(false);
  readonly step = signal(0);
  readonly refreshTarget = signal(0);
  readonly suspended = signal(false);

  readonly steps: GuidedTourStep[] = [
    { route: '/dashboard', icon: 'waving_hand', title: 'Bienvenue dans AquaManager', description: 'Je vais te guider directement dans le site. Tu vas découvrir les fonctions principales sans créer ni modifier aucune donnée.', instruction: 'Clique sur Suivant pour commencer.' },
    { route: '/dashboard', selector: '[data-tour="home-aquariums"]', icon: 'water_drop', title: 'Commence par tes aquariums', description: 'Tous tes suivis sont organisés par aquarium. Cette page est le point de départ pour créer un bac, ajouter des mesures et retrouver son entretien.', instruction: 'Clique maintenant sur le vrai bouton « Mes aquariums » mis en évidence.', waitForTargetClick: true },
    { route: '/aquariums', selector: '[data-tour="aquariums-summary"]', icon: 'monitoring', title: 'Une vue rapide de tes bacs', description: 'Ce résumé indique le nombre d’aquariums, ceux à surveiller et la limite correspondant à ton abonnement.', instruction: 'Aucune action n’est enregistrée pendant le tutoriel.' },
    { route: '/aquariums', selector: '[data-tour="aquarium-create"]', icon: 'add_circle', title: 'Crée ton aquarium de démonstration', description: 'Remplis le vrai formulaire avec le nom, les dimensions et le type d’eau de ton choix.', instruction: 'Clique sur « Nouvel aquarium ». Un bandeau confirmera que rien ne sera enregistré.', waitForTargetClick: true, advanceManually: true },
    { route: '/aquariums', selector: '[data-tour="aquarium-card"]', icon: 'view_module', title: 'Ouvre un aquarium', description: 'Chaque carte résume l’état du bac, ses dernières mesures et ses actions urgentes.', instruction: 'Clique sur une vraie carte aquarium pour découvrir sa fiche complète.', waitForTargetClick: true },
    { route: '/tutorial/aquarium', selector: '[data-tour="aquarium-detail-overview"]', icon: 'dashboard_customize', title: 'Voici ton aquarium temporaire', description: 'Cette fiche de démonstration fonctionne uniquement en mémoire. Elle disparaîtra totalement à la fin du tutoriel.', instruction: 'Le bandeau vert rappelle en permanence que rien n’est enregistré.' },
    { route: '/tutorial/aquarium', selector: '[data-tour="tutorial-add-measurement"]', icon: 'science', title: 'Ajoute une mesure fictive', description: 'Tu vas saisir quelques paramètres exactement comme dans une véritable fiche aquarium.', instruction: 'Clique sur « Ajouter une mesure » pour ouvrir le formulaire.', waitForTargetClick: true },
    { route: '/tutorial/aquarium', selector: '[data-tour="tutorial-measurement-fields"]', icon: 'edit', title: 'À toi de saisir deux valeurs', description: 'Renseigne le pH et la température directement dans les vrais champs du formulaire. Tu peux laisser tous les autres paramètres vides.', instruction: 'Saisis par exemple un pH de 7,2 et une température de 25 °C, puis clique sur « Suivant ».' },
    { route: '/tutorial/aquarium', selector: '[data-tour="tutorial-save-measurement"]', icon: 'save', title: 'Valide ta mesure de démonstration', description: 'AquaManager complétera automatiquement le NO₂, le NO₃, le GH et le KH pour construire un exemple réaliste.', instruction: 'Clique sur « Valider la mesure fictive ». Aucune requête ne sera envoyée.', waitForTargetClick: true },
    { route: '/tutorial/aquarium', selector: '[data-tour="tutorial-measurement-chart"]', icon: 'show_chart', title: 'Observe maintenant la tendance', description: 'Le tutoriel a créé six anciennes mesures fictives autour de tes deux valeurs. Le graphique montre immédiatement pourquoi un historique est plus utile qu’une mesure isolée.', instruction: 'Toutes les valeurs de cette courbe sont temporaires et disparaîtront en quittant le tutoriel.' },
    { route: '/tutorial/aquarium', selector: '.tabs-group .mat-mdc-tab:nth-child(2)', icon: 'task_alt', title: 'Passe aux tâches', description: 'Cet onglet organise tous les entretiens propres à l’aquarium.', instruction: 'Clique sur l’onglet « Tâches ».', waitForTargetClick: true },
    { route: '/tutorial/aquarium', selector: '[data-tour="tutorial-create-task"]', icon: 'add_task', title: 'Crée une tâche fictive', description: 'Cette simulation montre comment une action d’entretien apparaît dans le suivi.', instruction: 'Clique sur « Créer une tâche fictive ».', waitForTargetClick: true },
    { route: '/tutorial/aquarium', selector: '.tabs-group .mat-mdc-tab:nth-child(3)', icon: 'auto_awesome', title: 'Découvre les Solutions', description: 'L’assistant exploite les mesures saisies pour expliquer les écarts et proposer une action.', instruction: 'Clique sur l’onglet « Solutions ».', waitForTargetClick: true },
    { route: '/tutorial/aquarium', selector: '.tabs-group .mat-mdc-tab:nth-child(4)', icon: 'route', title: 'Découvre les Protocoles', description: 'Les protocoles préparent un programme guidé pour le cyclage, la routine ou une absence.', instruction: 'Clique sur l’onglet « Protocoles ».', waitForTargetClick: true },
    { route: '/tutorial/aquarium', selector: '[data-tour="tutorial-select-protocol"]', icon: 'rocket_launch', title: 'Prépare un protocole fictif', description: 'Tu peux simuler un protocole sans ajouter la moindre tâche au véritable calendrier.', instruction: 'Clique sur « Simuler un protocole de cyclage ».', waitForTargetClick: true },
    { route: '/tutorial/aquarium', selector: '.tabs-group .mat-mdc-tab:nth-child(5)', icon: 'pets', title: 'Découvre la population', description: 'Cette section regroupe les poissons, invertébrés et plantes du bac.', instruction: 'Clique sur « Dans mon Aquarium ».', waitForTargetClick: true },
    { route: '/tutorial/aquarium', selector: '[data-tour="tutorial-add-species"]', icon: 'set_meal', title: 'Ajoute un poisson fictif', description: 'La population aide AquaManager à adapter les paramètres de référence et les conseils.', instruction: 'Clique sur « Ajouter un poisson fictif » pour terminer cet exercice.', waitForTargetClick: true },
    { route: '/calendar', selector: '[data-tour="calendar-summary"]', icon: 'event_available', title: 'Ton entretien au même endroit', description: 'Le calendrier regroupe les tâches en retard, prévues aujourd’hui et à venir pour tous tes aquariums.', instruction: 'Les filtres permettent de se concentrer sur un bac ou un type d’entretien.' },
    { route: '/calendar', selector: '[data-tour="calendar-grid"]', icon: 'calendar_month', title: 'Organise les tâches simplement', description: 'Clique sur un jour pour préparer une tâche ponctuelle ou répétitive. Tu pourras ensuite la terminer, la modifier ou la déplacer.', instruction: 'Le tutoriel ne crée aucune tâche.' },
    { route: '/species', selector: '[data-tour="species-content"]', icon: 'menu_book', title: 'Prépare tes choix de poissons et plantes', description: 'Les fiches espèces présentent les besoins, paramètres, volumes et compatibilités utiles avant d’ajouter du vivant.', instruction: 'Ces ressources sont consultables indépendamment de tes aquariums.' },
    { route: '/profile', selector: '[data-tour="profile-content"]', icon: 'person', title: 'Ton profil et ton abonnement', description: 'Tu retrouves ici tes informations personnelles, ton abonnement et les accès correspondant à ton rôle.', instruction: 'Le lien Aide dans le footer permet de relancer ce parcours à tout moment.' },
  ];

  private firstVisitUserId: number | null = null;

  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: object,
    private readonly router: Router,
    private readonly tutorialData: TutorialDataService,
  ) {
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(() => {
      if (!this.opened()) return;
      const current = this.steps[this.step()];
      if (current.waitForTargetClick && !this.routeMatches(current.route, this.cleanUrl(this.router.url))) {
        this.step.update((value) => Math.min(value + 1, this.steps.length - 1));
      }
      setTimeout(() => this.refreshTarget.update((value) => value + 1));
    });
  }

  offerForUser(userId: number): void {
    if (!isPlatformBrowser(this.platformId) || !Number.isInteger(userId)) return;
    if (localStorage.getItem(this.seenKey(userId)) === '1') return;
    this.firstVisitUserId = userId;
    this.start();
  }

  open(): void {
    this.firstVisitUserId = null;
    this.start();
  }

  async next(): Promise<void> {
    const nextIndex = this.step() + 1;
    if (nextIndex >= this.steps.length) { this.close(); return; }
    this.step.set(nextIndex);
    if (isPlatformBrowser(this.platformId) && this.steps[this.step()].selector && !document.querySelector(this.steps[this.step()].selector!)) {
      const nextRegularPage = this.steps.findIndex((item, index) => index > this.step() && !item.route.includes('/:'));
      if (nextRegularPage > this.step()) this.step.set(nextRegularPage);
    }
    await this.ensureStepRoute();
    this.refreshTarget.update((value) => value + 1);
  }

  async previous(): Promise<void> {
    this.step.set(Math.max(0, this.step() - 1));
    await this.ensureStepRoute();
    this.refreshTarget.update((value) => value + 1);
  }

  close(): void {
    if (isPlatformBrowser(this.platformId) && this.firstVisitUserId !== null) {
      localStorage.setItem(this.seenKey(this.firstVisitUserId), '1');
    }
    this.firstVisitUserId = null;
    this.tutorialData.reset();
    this.opened.set(false);
    if (this.cleanUrl(this.router.url).startsWith('/tutorial/')) {
      void this.router.navigateByUrl('/dashboard');
    }
  }

  targetActivated(): void {
    if (!this.opened() || !this.steps[this.step()].waitForTargetClick) return;
    this.step.update((value) => Math.min(value + 1, this.steps.length - 1));
    void this.ensureStepRoute();
    this.refreshTarget.update((value) => value + 1);
  }

  suspend(value: boolean): void {
    this.suspended.set(value);
    if (!value) this.refreshTarget.update((current) => current + 1);
  }

  private start(): void {
    this.tutorialData.reset();
    this.suspended.set(false);
    this.step.set(0);
    this.opened.set(true);
    void this.ensureStepRoute();
  }

  private async ensureStepRoute(): Promise<void> {
    const route = this.steps[this.step()].route;
    if (!this.routeMatches(route, this.cleanUrl(this.router.url)) && !route.includes('/:')) {
      await this.router.navigateByUrl(route);
    }
    setTimeout(() => this.refreshTarget.update((value) => value + 1));
  }

  private cleanUrl(url: string): string { return url.split('?')[0].split('#')[0]; }
  private routeMatches(expected: string, actual: string): boolean {
    if (!expected.includes('/:')) return expected === actual;
    const pattern = '^' + expected.replace(/:[^/]+/g, '[^/]+') + '$';
    return new RegExp(pattern).test(actual);
  }
  private seenKey(userId: number): string { return `aquamanager-site-tour-v2:${userId}`; }
}
