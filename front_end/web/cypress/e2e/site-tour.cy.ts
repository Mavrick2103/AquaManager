/// <reference types="cypress" />

function setup(atLimit = false) {
  const writes: string[] = [];
  cy.intercept('**/api/**', req => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.url.includes('/auth/') && !req.url.endsWith('/satisfaction/visit')) writes.push(`${req.method} ${req.url}`);
    req.reply({ statusCode: 404, body: {} });
  });
  cy.intercept('POST', '**/api/auth/refresh', { access_token: 'TEST_TOKEN' });
  cy.intercept('GET', '**/api/users/me', { id: 1, email: 'camille@example.test', fullName: 'Camille', role: 'USER', subscriptionPlan: 'CLASSIC', subscriptionStatus: 'none' });
  const aquariums = atLimit ? [1, 2].map(id => ({ id, name: `Mon aquarium ${id}`, lengthCm: 60, widthCm: 30, heightCm: 35, volumeL: 63, waterType: 'EAU_DOUCE', startDate: '2026-01-01', createdAt: '2026-01-01', fishCount: 0, plantCount: 0, activeProtocolCount: 0, overdueTaskCount: 0 })) : [];
  cy.intercept('GET', '**/api/aquariums', aquariums);
  cy.intercept('GET', '**/api/aquariums/overview', aquariums);
  cy.intercept('GET', '**/api/aquariums/retention-status', { archivedCount: 0, nextDeletionAt: null });
  cy.intercept('GET', '**/api/aquariums/*/measurements*', []);
  cy.intercept('GET', '**/api/tasks*', []);
  cy.intercept('GET', '**/api/gamification/summary', { statusCode: 503 });
  cy.intercept('GET', '**/api/fish-cards*', []);
  cy.intercept('GET', '**/api/settings', { notificationsEnabled: false, emailNotifications: false, pushNotifications: false, taskReminders: true, automaticNotifications: true, newsAndUpdates: false });
  cy.intercept('GET', '**/api/billing/paypal/status', { ready: true, premium: false, provider: null, canCancel: false });
  cy.intercept('POST', '**/api/satisfaction/visit', { prompt: false, canSubmit: true });
  return writes;
}

function reachable(selector: string) {
  cy.get(selector).should('be.visible').should($element => {
    const element = $element[0];
    const rect = element.getBoundingClientRect();
    const window = element.ownerDocument.defaultView!;
    expect(rect.top, 'bouton au-dessus du bas de l’écran').to.be.at.least(0);
    expect(rect.bottom, 'bouton dans la hauteur visible').to.be.at.most(window.innerHeight);
    expect(rect.right, 'bouton dans la largeur visible').to.be.at.most(window.innerWidth);
    const hit = element.ownerDocument.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    expect(hit && element.contains(hit), 'bouton accessible sans superposition').to.equal(true);
  });
}
function step(title: string) {
  cy.get('#tour-title').should('have.text', title);
  cy.get('.tour-next').should('not.be.disabled');
  reachable('.tour-next');
  cy.window().should(window => expect(window.document.documentElement.scrollWidth).to.be.at.most(window.innerWidth));
}
function next() { reachable('.tour-next'); cy.get('.tour-next').should('not.be.disabled').click(); }
function start() {
  cy.visit('/dashboard');
  cy.contains('button', 'Aide · Revoir le tutoriel').click();
  step('Une visite express');
  cy.get('.tour-location').should('contain.text', 'sur 5');
}

function noForm() {
  cy.get('.mat-mdc-dialog-container').should('not.exist');
  cy.get('app-tutorial-aquarium input, app-tutorial-aquarium textarea, app-tutorial-aquarium form').should('not.exist');
}

describe('Visite express : aquariums, tâches, solutions', () => {
  it('propose la visite à la première connexion et revient au tableau de bord quand on quitte', () => {
    cy.viewport(390, 844);
    setup();
    cy.intercept('POST', '**/api/auth/login', { access_token: 'TEST_TOKEN' });
    cy.intercept('GET', '**/api/users/me', { id: 9981, email: 'nouveau@example.test', fullName: 'Nouveau', role: 'USER', subscriptionPlan: 'CLASSIC' });
    cy.visit('/login');
    cy.contains('mat-label', 'Adresse e-mail').click();
    cy.get('input[formControlName=email]').type('nouveau@example.test');
    cy.contains('mat-label', 'Mot de passe').click();
    cy.get('input[formControlName=password]').type('TestPassword123');
    cy.get('button[type=submit]').click();
    step('Une visite express');
    cy.get('.tour-close').click();
    cy.location('pathname').should('eq', '/dashboard');
    cy.window().then(window => expect(window.localStorage.getItem('aquamanager-site-tour-v2:9981')).to.eq('1'));
  });

  it('présente les trois fonctions en cinq étapes sans formulaire ni écriture dans le compte', () => {
    cy.viewport(360, 640);
    const writes = setup(true);
    start();
    next();
    step('Ton aquarium, au même endroit');
    noForm();
    cy.get('.demo-values').should('contain.text', '7.2').and('contain.text', '25 °C');
    cy.get('.tabs-group [role=tab]').should('have.length', 3);
    cy.screenshot('tour-express-mobile-aquarium', { capture: 'viewport' });
    next();
    step('Prévoir et terminer une tâche');
    noForm();
    reachable('[data-tour="tutorial-complete-task"]');
    cy.get('[data-tour="tutorial-complete-task"]').click();
    cy.get('.tour-success').should('be.visible');
    cy.get('.task-example').should('contain.text', 'Réalisé dans la démonstration');
    next();
    step('Des conseils pour ton bac');
    noForm();
    cy.viewport(360, 460);
    reachable('.tour-next');
    cy.viewport(360, 640);
    reachable('[data-tour="tutorial-apply-solution"]');
    cy.screenshot('tour-express-mobile-solutions', { capture: 'viewport' });
    cy.get('[data-tour="tutorial-apply-solution"]').click();
    cy.get('.tour-success').should('be.visible').and('contain.text', 'tâche de contrôle');
    next();
    step('Ton suivi peut commencer');
    next();
    cy.location('pathname').should('eq', '/aquariums');
    cy.get('.tour-tooltip').should('not.exist');
    cy.get('.aquarium-card').should('have.length', 2).and('not.contain.text', 'Mon bac de découverte');
    cy.then(() => expect(writes).to.deep.equal([]));
  });

  it('laisse passer les essais et revenir en arrière sur petit écran et en paysage', () => {
    cy.viewport(320, 568);
    setup();
    start();
    next();
    step('Ton aquarium, au même endroit');
    next();
    step('Prévoir et terminer une tâche');
    cy.get('.tour-skip').click();
    step('Des conseils pour ton bac');
    cy.get('.tour-back').click();
    step('Prévoir et terminer une tâche');
    cy.viewport(667, 375);
    cy.get('.tour-tooltip').should($panel => expect($panel[0].getBoundingClientRect().left).to.be.greaterThan(250));
    reachable('.tour-next'); reachable('.tour-back'); reachable('.tour-close');
    cy.screenshot('tour-express-landscape', { capture: 'viewport' });
    cy.get('.tour-close').click();
    cy.location('pathname').should('eq', '/dashboard');
    cy.get('html').should('not.have.class', 'site-tour-active');
  });

  it('continue même si un élément manque et se relance sur ordinateur', () => {
    cy.viewport(1280, 800);
    setup();
    start();
    next();
    step('Ton aquarium, au même endroit');
    cy.screenshot('tour-express-desktop', { capture: 'viewport' });
    let stopRemoving = () => {};
    cy.document().then(document => {
      const observer = new document.defaultView!.MutationObserver(() => document.querySelector('[data-tour="tutorial-complete-task"]')?.remove());
      observer.observe(document.body, { childList: true, subtree: true });
      stopRemoving = () => observer.disconnect();
    });
    next();
    cy.get('.tour-unavailable', { timeout: 6000 }).should('be.visible');
    cy.then(() => stopRemoving());
    next();
    step('Des conseils pour ton bac');
    cy.get('.tour-close').click();
    cy.contains('button', 'Aide · Revoir le tutoriel').click();
    step('Une visite express');
    cy.get('.tour-close').click();
  });
});

