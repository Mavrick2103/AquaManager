import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { SiteTourService } from './site-tour.service';
import { TutorialDataService } from './tutorial-data.service';

describe('Visite express Classic', () => {
  let tour: SiteTourService;
  let data: TutorialDataService;
  let events: Subject<NavigationEnd>;
  let router: { url: string; events: Subject<NavigationEnd>; navigateByUrl: jasmine.Spy };
  beforeEach(() => {
    events = new Subject();
    router = { url: '/dashboard', events, navigateByUrl: jasmine.createSpy('navigateByUrl').and.callFake(async (url: string) => {
      router.url = url;
      events.next(new NavigationEnd(1, url, url));
      return true;
    }) };
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: router }] });
    tour = TestBed.inject(SiteTourService);
    data = TestBed.inject(TutorialDataService);
    localStorage.removeItem('aquamanager-site-tour-v2:9981');
  });
  afterEach(() => { events.complete(); localStorage.removeItem('aquamanager-site-tour-v2:9981'); });

  it('reste court et se limite aux aquariums, tâches et solutions', () => {
    expect(tour.steps).toHaveSize(5);
    expect(tour.steps.filter(step => step.demoTab != null).map(step => step.demoTab)).toEqual([0, 1, 2]);
    expect(tour.steps.some(step => ['/calendar', '/species', '/profile'].some(route => step.route.startsWith(route)))).toBeFalse();
  });

  it('ouvre directement un aquarium et ses mesures préremplis', async () => {
    tour.open();
    await tour.next();
    expect(tour.steps[tour.step()].id).toBe('aquarium');
    expect(router.url).toBe('/tutorial/aquarium');
    expect(data.aquarium()?.id).toBe(-1);
    expect(data.measurements()).toHaveSize(7);
    expect(data.measurement()?.['ph']).toBe(7.2);
  });

  it('permet de passer les actions et de terminer sans saisie', async () => {
    tour.open();
    await tour.next();
    await tour.next();
    expect(tour.steps[tour.step()].id).toBe('tasks');
    await tour.next();
    expect(tour.steps[tour.step()].id).toBe('solutions');
    await tour.next();
    expect(tour.steps[tour.step()].id).toBe('finish');
    expect(data.taskCompleted()).toBeFalse();
    expect(data.solutionTaskCreated()).toBeFalse();
    await tour.next();
    expect(tour.opened()).toBeFalse();
    expect(router.url).toBe('/aquariums');
  });

  it('conserve les actions d’essai au retour sans accepter une autre étape', async () => {
    tour.open();
    await tour.next();
    await tour.next();
    tour.complete('solutions');
    expect(tour.currentComplete).toBeFalse();
    data.taskCompleted.set(true);
    tour.complete('tasks');
    await tour.next();
    await tour.previous();
    expect(tour.currentComplete).toBeTrue();
    expect(data.taskCompleted()).toBeTrue();
  });

  it('nettoie les essais et retrouve la page de départ quand on quitte', async () => {
    router.url = '/calendar';
    tour.open();
    await tour.next();
    tour.close();
    expect(tour.opened()).toBeFalse();
    expect(data.aquarium()).toBeNull();
    expect(data.measurements()).toHaveSize(0);
    expect(router.url).toBe('/calendar');
  });

  it('ferme la première visite sur le tableau de bord, même après une connexion', async () => {
    router.url = '/login';
    tour.offerForUser(9981);
    await Promise.resolve();
    tour.close();
    expect(router.url).toBe('/dashboard');
    expect(localStorage.getItem('aquamanager-site-tour-v2:9981')).toBe('1');
    tour.offerForUser(9981);
    expect(tour.opened()).toBeFalse();
  });
});
