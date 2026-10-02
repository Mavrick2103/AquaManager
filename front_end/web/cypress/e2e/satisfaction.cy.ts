/// <reference types="cypress" />
const ready = {
  segment: 'CLASSIC',
  source: 'FREE',
  prompt: true,
  canSubmit: true,
  nextResponseAt: null,
};
function auth(role = 'USER') {
  cy.intercept('**/api/**', { statusCode: 404, body: {} });
  cy.intercept('POST', '**/api/auth/refresh', { access_token: 'TEST_TOKEN' });
  cy.intercept('GET', '**/api/users/me', {
    id: 1,
    fullName: 'Camille',
    email: 'camille@example.test',
    role,
    subscriptionPlan: 'CLASSIC',
  });
  cy.intercept('GET', '**/api/tasks*', []);
  cy.intercept('GET', '**/api/aquariums*', []);
  cy.intercept('GET', '**/api/gamification/**', { statusCode: 503 });
}
describe('Satisfaction utilisateur', () => {
  beforeEach(() => {
    auth();
    cy.viewport(1280, 720);
  });
  it('envoie un avis Classic sans question Premium et affiche le remerciement', () => {
    cy.intercept('POST', '**/api/satisfaction/visit', ready);
    cy.intercept('POST', '**/api/satisfaction', { ok: true }).as('submit');
    cy.visit('/dashboard');
    cy.contains('button', 'Donner mon avis').click();
    cy.get('app-satisfaction form').should('be.visible');
    cy.get('input[name=premiumRating]').should('not.exist');
    cy.get('.ratings label').eq(3).click();
    cy.get('textarea[name=comment]').type('Le suivi des mesures est très pratique.');
    cy.get('app-satisfaction').should('have.length', 1).scrollIntoView({ offset: { top: -90, left: 0 } });
    cy.screenshot('satisfaction-classic', { capture: 'viewport' });
    cy.contains('button', 'Envoyer mon avis').click();
    cy.wait('@submit')
      .its('request.body')
      .should('deep.equal', { rating: 4, comment: 'Le suivi des mesures est très pratique.' });
    cy.contains('Merci pour ton avis !').should('be.visible');
  });
  it('demande une note Premium distincte et fonctionne sur mobile', () => {
    cy.viewport(390, 844);
    cy.intercept('POST', '**/api/satisfaction/visit', { ...ready, segment: 'PREMIUM' });
    cy.intercept('POST', '**/api/satisfaction', { ok: true }).as('submit');
    cy.visit('/dashboard');
    cy.contains('button', 'Donner mon avis').click();
    cy.get('.ratings label').eq(4).click();
    cy.contains('button', 'Envoyer mon avis').should('be.disabled');
    cy.get('.premium-ratings label').eq(2).click();
    cy.get('app-satisfaction').should('have.length', 1).scrollIntoView({ offset: { top: -90, left: 0 } });
    cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
    cy.screenshot('satisfaction-premium-mobile', { capture: 'viewport' });
    cy.contains('button', 'Envoyer mon avis').click();
    cy.wait('@submit').its('request.body').should('include', { rating: 5, premiumRating: 3 });
  });
  it('reporte une invitation et n’affiche rien pour les utilisateurs non éligibles', () => {
    cy.intercept('POST', '**/api/satisfaction/visit', ready);
    cy.intercept('POST', '**/api/satisfaction/dismiss', { ok: true }).as('dismiss');
    cy.visit('/dashboard');
    cy.get('app-satisfaction').should('have.length', 1).scrollIntoView({ offset: { top: -90, left: 0 } });
    cy.screenshot('satisfaction-invitation', { capture: 'viewport' });
    cy.contains('button', 'Plus tard').click();
    cy.wait('@dismiss');
    cy.get('app-satisfaction .survey').should('not.exist');
    cy.intercept('POST', '**/api/satisfaction/visit', { ...ready, prompt: false });
    cy.reload();
    cy.get('app-satisfaction .survey').should('not.exist');
  });
  it('affiche une erreur d’envoi sans perdre le commentaire', () => {
    cy.intercept('POST', '**/api/satisfaction/visit', ready);
    cy.intercept('POST', '**/api/satisfaction', { statusCode: 500 });
    cy.visit('/dashboard');
    cy.contains('button', 'Donner mon avis').click();
    cy.get('.ratings label').eq(1).click();
    cy.get('textarea').type('Il manque une option.');
    cy.contains('button', 'Envoyer mon avis').click();
    cy.get('app-satisfaction [role=alert]').should('be.visible');
    cy.get('textarea').should('have.value', 'Il manque une option.');
  });
  it('ouvre le questionnaire depuis le profil sans enregistrer une visite', () => {
    cy.intercept('GET', '**/api/satisfaction', ready).as('status');
    cy.intercept('GET', '**/api/settings', { notificationsEnabled: false });
    cy.visit('/profile?tab=feedback');
    cy.contains('button', 'Donner mon avis').click();
    cy.wait('@status');
    cy.get('app-satisfaction form').should('be.visible');
  });
});
describe('Administration des avis', () => {
  it('affiche les indicateurs, filtre les offres et permet le suivi', () => {
    auth('ADMIN');
    cy.viewport(1280, 720);
    const classic = {
      segment: 'CLASSIC',
      count: 10,
      average: 4.1,
      satisfied: 8,
      premiumAverage: null,
      premiumCount: 0,
      premiumSatisfied: 0,
      n1: 0,
      n2: 1,
      n3: 1,
      n4: 4,
      n5: 4,
    };
    const premium = {
      ...classic,
      segment: 'PREMIUM',
      count: 5,
      average: 4.6,
      satisfied: 5,
      premiumAverage: 4,
      premiumCount: 5,
      premiumSatisfied: 4,
      n1: 0,
      n2: 0,
      n3: 0,
      n4: 2,
      n5: 3,
    };
    let status = 'NEW';
    cy.intercept('GET', '**/api/admin/satisfaction*', (req) =>
      req.reply({
        totals: [classic, premium],
        monthly: [
          { ...classic, month: '2026-10' },
          { ...premium, month: '2026-10' },
        ],
        items: [
          {
            id: 1,
            userId: 1,
            user: { fullName: 'Camille' },
            segment: 'PREMIUM',
            source: 'PAID',
            rating: 5,
            premiumRating: 4,
            comment: '<img src=x onerror=alert(1)> Plus de conseils sur les crevettes.',
            createdAt: '2026-10-01',
            status,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
    ).as('report');
    cy.intercept('PATCH', '**/api/admin/satisfaction/1', (req) => {
      status = req.body.status;
      req.reply({ ok: true });
    }).as('review');
    cy.visit('/admin/satisfaction');
    cy.wait('@report');
    cy.contains('80%').should('be.visible');
    cy.contains('100%').should('be.visible');
    cy.screenshot('satisfaction-admin', { capture: 'viewport' });
    cy.get('.review select').select('READ');
    cy.wait('@review').its('request.body.status').should('equal', 'READ');
    cy.wait('@report');
    cy.get('.review img').should('not.exist');
    cy.get('.filters select').first().select('PREMIUM');
    cy.wait('@report').its('request.url').should('include', 'segment=PREMIUM');
    cy.get('.score-card').should('have.length', 1);
    cy.viewport(390, 844);
    cy.get('.page-header').scrollIntoView();
    cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
    cy.screenshot('satisfaction-admin-mobile', { capture: 'viewport' });
  });
});
