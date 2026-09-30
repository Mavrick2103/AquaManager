/// <reference types="cypress" />
const health = {
  mysql: 'ok',
  disk: { status: 'ok', usedPercent: 24, freeBytes: 25000000000, totalBytes: 33000000000 },
  backup: { status: 'unknown', lastAt: null, ageHours: null },
  uptimeSeconds: 86400,
  memoryBytes: 90000000,
  generatedAt: new Date().toISOString(),
};
const overview = {
  generatedAt: new Date().toISOString(),
  users: {
    total: 128,
    newInRange: 18,
    activeInRange: 46,
    recentRegistrations: [
      {
        id: 2,
        fullName: 'Camille Martin',
        email: 'camille@example.test',
        createdAt: new Date().toISOString(),
        emailVerifiedAt: null,
        subscriptionPlan: 'CLASSIC',
        subscriptionStatus: 'none',
        subscriptionEndsAt: null,
      },
    ],
  },
  subscriptions: { totalActive: 24, premiumActive: 22, proActive: 2, expiringSoon: 4 },
  attention: { unverifiedUsers: 7, inactiveUsers: 22, overdueTasks: 9 },
  moderation: { pendingArticles: 2, pendingFishCards: 3, pendingPlantCards: 1, totalPending: 6 },
  aquariums: { total: 190, createdInRange: 12 },
  measurements: { total: 850, createdInRange: 63 },
  tasks: { total: 320, createdInRange: 31 },
  operations: {
    infrastructure: health,
    alerts: {
      trackingAvailable: true,
      apiErrors: 2,
      paypalFailures: 1,
      stripeFailures: 0,
      emailFailures: 0,
    },
  },
  featureUsage: { ai: { events: 27, users: 9 } },
};
function session(role = 'ADMIN') {
  cy.intercept('POST', '**/api/auth/refresh', { body: { access_token: 'TEST_TOKEN' } });
  cy.intercept('GET', '**/api/users/me', {
    body: { id: 1, fullName: 'Administrateur', email: 'admin@example.test', role },
  });
  cy.intercept('GET', '**/api/admin/metrics?*', { body: overview }).as('metrics');
  cy.intercept('GET', '**/api/admin/metrics/series/new-users?*', {
    body: [
      { label: '24/09', count: 1 },
      { label: '25/09', count: 3 },
      { label: '26/09', count: 2 },
      { label: '27/09', count: 4 },
      { label: '28/09', count: 3 },
      { label: '29/09', count: 2 },
      { label: '30/09', count: 3 },
    ],
  }).as('series');
}
function noOverflow(width: number) {
  cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.be.at.most(width));
}
describe('Administration reorganisée', () => {
  beforeEach(() => session());
  it('affiche les vrais périmètres de suivi et les nouveaux inscrits', () => {
    cy.viewport(1280, 720);
    cy.visit('/admin');
    cy.wait('@metrics');
    cy.contains('h1', 'Vue d’ensemble');
    cy.contains('Camille Martin');
    cy.contains('accès offerts inclus');
    cy.get('nav[aria-label="Navigation de l’administration"] a').should('have.length', 9);
    cy.get('a[aria-current="page"]').should('contain.text', 'Vue d’ensemble');
    cy.get('aside[appAdminSidebar]').then(el => expect(el[0].scrollHeight).to.be.at.most(el[0].clientHeight));
    noOverflow(1280);
    cy.scrollTo(0,0);
    cy.screenshot('admin-overview-desktop', { capture: 'viewport' });
    cy.get('.actions select').select('30d');
    cy.wait('@metrics').its('request.query.range').should('eq', '30d');
  });
  it('propose un menu mobile repliable et sans débordement', () => {
    cy.viewport(390, 844);
    cy.visit('/admin/metrics');
    cy.wait('@metrics');
    cy.wait('@series');
    cy.get('.stats').should('be.visible');
    cy.document().then(doc => doc.fonts.ready);
    cy.get('#admin-navigation').should('not.be.visible');
    cy.get('.menu-toggle').click();
    cy.get('#admin-navigation').should('be.visible');
    cy.contains('nav a', 'Utilisateurs').should('be.visible');
    cy.get('.menu-toggle').click();
    noOverflow(390);
    cy.screenshot('admin-overview-mobile', { capture: 'viewport' });
  });
  it('filtre et pagine les journaux avec une sauvegarde non vérifiée', () => {
    cy.intercept('GET', '**/api/admin/operations/health', { body: health });
    cy.intercept('GET', '**/api/admin/operations?*', (req) =>
      req.reply({
        items: [
          {
            id: 1,
            type: 'PAYPAL_FAILURE',
            route: '/billing/paypal/:id',
            statusCode: 503,
            createdAt: new Date().toISOString(),
          },
        ],
        total: 26,
        generatedAt: new Date().toISOString(),
      }),
    ).as('logs');
    cy.visit('/admin/operations');
    cy.wait('@logs');
    cy.contains('Non vérifié');
    cy.get('select[name=type]').select('PAYPAL_FAILURE');
    cy.contains('button', 'Appliquer').click();
    cy.wait('@logs').its('request.query.type').should('eq', 'PAYPAL_FAILURE');
    cy.contains('button', 'Suivant').click();
    cy.wait('@logs').its('request.query.page').should('eq', '2');
    cy.viewport(390, 844);
    noOverflow(390);
  });
  it('ne présente pas un journal indisponible comme une absence d’incident', () => {
    cy.intercept('GET', '**/api/admin/operations/health', { statusCode: 503 });
    cy.intercept('GET', '**/api/admin/operations?*', { statusCode: 503 });
    cy.visit('/admin/operations');
    cy.contains('Journal indisponible');
    cy.contains('Aucun incident enregistré').should('not.exist');
    cy.contains('État du serveur indisponible');
  });
  it('sépare les paiements réels des tests et applique le filtre de résiliation', () => {
    cy.intercept('GET', '**/api/admin/subscriptions?*', {
      body: {
        items: [],
        total: 0,
        configuredEnvironment: 'live',
        overview: { total: 14, active: 10, pending: 1, cancelled: 2, suspended: 1, expired: 0 },
      },
    }).as('subscriptions');
    cy.viewport(1280, 720);
    cy.visit('/admin/subscriptions');
    cy.wait('@subscriptions').its('request.query.environment').should('eq', 'live');
    cy.get('select[name=status]').select('CANCELLED');
    cy.contains('button', 'Rechercher').click();
    cy.wait('@subscriptions').its('request.query.status').should('eq', 'CANCELLED');
    cy.contains('Résiliées');
    cy.scrollTo(0,0);
    cy.screenshot('admin-subscriptions-desktop', { capture: 'viewport' });
    cy.viewport(390, 844);
    noOverflow(390);
  });
  it('filtre les inscriptions récentes et exclut les accès expirés du compteur actif', () => {
    const common = {
      role: 'USER',
      subscriptionPlan: 'PREMIUM',
      subscriptionStatus: 'active',
      emailVerifiedAt: null,
      lastActivityAt: null,
    };
    cy.intercept('GET', '**/api/admin/users*', {
      body: [
        {
          ...common,
          id: 2,
          fullName: 'Compte récent',
          email: 'recent@example.test',
          createdAt: new Date().toISOString(),
          subscriptionEndsAt: new Date(Date.now() + 86400000).toISOString(),
        },
        {
          ...common,
          id: 3,
          fullName: 'Compte ancien',
          email: 'old@example.test',
          createdAt: '2020-01-01',
          subscriptionEndsAt: '2020-02-01',
        },
      ],
    }).as('users');
    cy.viewport(1280, 720);
    cy.visit('/admin/users');
    cy.wait('@users');
    cy.get('.user-overview article').eq(2).find('strong').should('have.text', '1');
    cy.get('[data-testid=registration-filter]').select('7 derniers jours');
    cy.get('table')
      .should('contain.text', 'Compte récent')
      .and('not.contain.text', 'Compte ancien');
    cy.viewport(390, 844);
    noOverflow(390);
  });
});

describe('Navigation des contenus et de la communication', () => {
  beforeEach(() => {
    session();
    cy.intercept('GET', '**/api/admin/articles*', { body: [] });
    cy.intercept('GET', '**/api/admin/articles/themes*', { body: [] });
    cy.intercept('GET', '**/api/admin/fish-cards*', { body: [] });
    cy.intercept('GET', '**/api/admin/plant-cards*', { body: [] });
    cy.intercept('GET', '**/api/admin/users*', { body: [] });
    cy.intercept('POST', '**/api/admin/emailing/preview', {
      body: { count: 0, optedInCount: 0, recipients: [], truncated: false },
    });
    cy.intercept('GET', '**/api/admin/marketing', { body: [] });
    cy.intercept('GET', '**/api/admin/marketing/instagram/status', {
      body: { connected: false, username: null, accountId: null },
    });
    cy.intercept('GET', '**/api/admin/marketing/agent/settings', {
      body: { enabled: false, cadence: 'weekly', dayOfWeek: 1, hour: 9, minute: 0 },
    });
  });
  for (const route of ['articles', 'species/fish', 'species/plant', 'emailing', 'marketing'])
    it('conserve une navigation cohérente pour ' + route, () => {
      cy.viewport(1280, 720);
      cy.visit('/admin/' + route);
      cy.get('main').should('be.visible');
      cy.get('a[aria-current="page"]').should('have.attr', 'href', '/admin/' + route);
      noOverflow(1280);
      cy.viewport(390, 844);
      cy.get('.menu-toggle').should('be.visible');
      noOverflow(390);
    });
});

describe('Filtres de l’annuaire', () => {
 it('combine les catégories, retire un filtre et réinitialise les résultats', () => {
  session();
  const common = {createdAt:new Date().toISOString(),lastActivityAt:new Date().toISOString(),subscriptionEndsAt:null};
  cy.intercept('GET','**/api/admin/users*',{body:[
   {...common,id:2,fullName:'Camille Martin',email:'camille@example.test',role:'ADMIN',subscriptionPlan:'PREMIUM',subscriptionStatus:'active',emailVerifiedAt:new Date().toISOString()},
   {...common,id:3,fullName:'Alex Laurent',email:'alex@example.test',role:'EDITOR',subscriptionPlan:'CLASSIC',subscriptionStatus:'none',emailVerifiedAt:null},
   {...common,id:4,fullName:'Sacha Dubois',email:'sacha@example.test',role:'USER',subscriptionPlan:'PREMIUM',subscriptionStatus:'active',subscriptionEndsAt:'2020-01-01',emailVerifiedAt:null},
  ]}).as('directory');
  cy.viewport(1280,900);cy.visit('/admin/users');cy.wait('@directory');cy.document().then(doc=>doc.fonts.ready);
  cy.get('.directory-results').should('contain.text','3 résultats');
  cy.get('[data-testid=role-filter]').select('ADMIN');cy.get('[data-testid=plan-filter]').select('active');
  cy.get('.directory-results').should('contain.text','1 résultat');cy.get('table').should('contain.text','Camille Martin').and('not.contain.text','Alex Laurent');
  cy.get('[data-testid=verification-filter]').select('pending');cy.contains('.empty-title','Aucun utilisateur');
  cy.get('button[aria-label="Retirer le filtre Email à confirmer"]').click();cy.get('.directory-results').should('contain.text','1 résultat');
  cy.contains('button','Réinitialiser').click();cy.get('.directory-results').should('contain.text','3 résultats');cy.get('.filter-chips').should('not.exist');
  cy.scrollTo(0,0);cy.screenshot('admin-users-redesign-desktop',{capture:'fullPage'});noOverflow(1280);
  cy.viewport(390,844);cy.get('[data-testid=role-filter]').select('EDITOR');cy.get('.users-cards').should('contain.text','Alex Laurent').and('not.contain.text','Camille Martin');noOverflow(390);cy.scrollTo(0,0);cy.screenshot('admin-users-redesign-mobile',{capture:'fullPage'});
 });
});
