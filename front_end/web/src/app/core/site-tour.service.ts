import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { TutorialDataService } from './tutorial-data.service';

export type GuidedTourStep = {
  id: string;
  chapter: string;
  route: string;
  selector?: string;
  icon: string;
  title: string;
  description: string;
  instruction?: string;
  actionLabel?: string;
  continueLabel?: string;
  success?: string;
  waitForTargetClick?: boolean;
  advanceManually?: boolean;
  demoTab?: number;
};

@Injectable({ providedIn: 'root' })
export class SiteTourService {
  readonly opened = signal(false);
  readonly step = signal(0);
  readonly refreshTarget = signal(0);
  readonly suspended = signal(false);
  readonly navigating = signal(false);
  readonly completed = signal<ReadonlySet<string>>(new Set());

  readonly steps: GuidedTourStep[] = [
    { id: 'welcome', chapter: 'Découverte Classic', route: '/dashboard', icon: 'waving_hand', title: 'Une visite express', description: 'Aquariums, tâches, solutions : découvre l’essentiel de Classic avec un exemple déjà prêt.', actionLabel: 'Voir l’aquarium' },
    { id: 'aquarium', chapter: '1 · Aquariums', route: '/tutorial/aquarium', selector: '[data-tour="tutorial-aquarium-summary"]', demoTab: 0, icon: 'water_drop', title: 'Ton aquarium, au même endroit', description: 'Chaque fiche rassemble les mesures et l’entretien du bac. Classic permet de suivre deux aquariums.', actionLabel: 'Voir les tâches' },
    { id: 'tasks', chapter: '2 · Tâches', route: '/tutorial/aquarium', selector: '[data-tour="tutorial-complete-task"]', demoTab: 1, icon: 'task_alt', title: 'Prévoir et terminer une tâche', description: 'Planifie tes entretiens, puis coche ce qui a été fait. Essaie avec le test d’eau déjà prévu.', actionLabel: 'Marquer comme fait', continueLabel: 'Voir les solutions', success: 'Le test d’eau est marqué comme réalisé dans le bac d’exemple.', waitForTargetClick: true, advanceManually: true },
    { id: 'solutions', chapter: '3 · Solutions', route: '/tutorial/aquarium', selector: '[data-tour="tutorial-apply-solution"]', demoTab: 2, icon: 'lightbulb', title: 'Des conseils pour ton bac', description: 'L’assistant Classic utilise tes mesures pour proposer des vérifications. Un conseil peut devenir une tâche.', actionLabel: 'Prévoir le contrôle', continueLabel: 'Terminer la visite', success: 'Une tâche de contrôle est préparée dans la démonstration.', waitForTargetClick: true, advanceManually: true },
    { id: 'finish', chapter: 'À toi de jouer', route: '/aquariums', icon: 'check_circle', title: 'Ton suivi peut commencer', description: 'Crée ton aquarium, note tes mesures et prévois ton prochain entretien. Tu retrouveras les conseils dans Solutions.', actionLabel: 'Ouvrir mes aquariums' },
  ];

  private firstVisitUserId: number | null = null;
  private returnUrl = '/dashboard';
  private navigationVersion = 0;

  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: object,
    private readonly router: Router,
    private readonly tutorialData: TutorialDataService,
  ) {
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(() => {
      if (!this.opened()) return;
      const current = this.steps[this.step()];
      const next = this.steps[this.step() + 1];
      if (!this.navigating() && current.waitForTargetClick && !current.advanceManually && next && this.cleanUrl(current.route) !== this.cleanUrl(next.route) && this.cleanUrl(this.router.url) === this.cleanUrl(next.route)) {
        this.step.update(index => index + 1);
      }
      this.refreshTarget.update(value => value + 1);
    });
  }

  get currentComplete(): boolean { return this.completed().has(this.steps[this.step()].id); }

  offerForUser(userId: number): void {
    if (!isPlatformBrowser(this.platformId) || !Number.isInteger(userId) || this.opened()) return;
    try { if (localStorage.getItem(this.seenKey(userId)) === '1') return; } catch { /* Storage may be unavailable. */ }
    this.firstVisitUserId = userId;
    this.start();
  }

  open(): void { this.firstVisitUserId = null; this.start(); }

  async next(): Promise<void> {
    if (!this.opened() || this.navigating() || this.suspended()) return;
    if (this.step() === this.steps.length - 1) { this.close('/aquariums'); return; }
    this.step.update(index => index + 1);
    await this.ensureStepRoute();
  }

  async previous(): Promise<void> {
    if (!this.opened() || this.navigating() || this.suspended()) return;
    this.step.update(index => Math.max(0, index - 1));
    await this.ensureStepRoute();
  }

  complete(id: string): void {
    if (!this.opened() || this.steps[this.step()].id !== id) return;
    this.completed.update(previous => new Set([...previous, id]));
    this.refreshTarget.update(value => value + 1);
  }

  close(destination?: string): void {
    this.navigationVersion++;
    if (isPlatformBrowser(this.platformId) && this.firstVisitUserId !== null) {
      try { localStorage.setItem(this.seenKey(this.firstVisitUserId), '1'); } catch { /* Closing must always work. */ }
    }
    this.firstVisitUserId = null;
    this.opened.set(false);
    this.suspended.set(false);
    this.navigating.set(false);
    this.tutorialData.reset();
    void this.router.navigateByUrl(destination ?? this.returnUrl);
  }

  targetActivated(id?: string): void {
    const current = this.steps[this.step()];
    if (!this.opened() || (id && current.id !== id) || !current.waitForTargetClick || current.advanceManually) return;
    // RouterLink owns page changes. NavigationEnd advances only to the expected route.
    const next = this.steps[this.step() + 1];
    if (next && this.cleanUrl(next.route) === this.cleanUrl(current.route)) void this.next();
  }

  suspend(value: boolean): void {
    this.suspended.set(value);
    if (!value) this.refreshTarget.update(current => current + 1);
  }

  private start(): void {
    this.navigationVersion++;
    this.returnUrl = this.firstVisitUserId !== null || this.router.url.startsWith('/tutorial/') ? '/dashboard' : this.router.url;
    this.tutorialData.reset();
    this.completed.set(new Set());
    this.suspended.set(false);
    this.step.set(0);
    this.opened.set(true);
    void this.ensureStepRoute();
  }

  private async ensureStepRoute(): Promise<void> {
    const version = ++this.navigationVersion;
    const current = this.steps[this.step()];
    this.navigating.set(true);
    if (current.route.startsWith('/tutorial/')) this.tutorialData.prepareStep(current.id);
    try {
      if (this.cleanUrl(current.route) !== this.cleanUrl(this.router.url) || (current.route.includes('?') && current.route !== this.router.url)) {
        await this.router.navigateByUrl(current.route);
      }
    } finally {
      if (version === this.navigationVersion) {
        this.navigating.set(false);
        this.refreshTarget.update(value => value + 1);
      }
    }
  }

  private cleanUrl(url: string): string { return url.split('?')[0].split('#')[0]; }
  private seenKey(userId: number): string { return `aquamanager-site-tour-v2:${userId}`; }
}
