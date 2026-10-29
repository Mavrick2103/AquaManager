/// <reference types="cypress" />
describe('Parcours utilisateur', () => {
  const totals = { registered: 70, aquarium: 40, activated: 30, measurement: 25, task: 20, solutions: 15, returnEligible: 20, returned: 5, checkout: 4, paid: 1 };
  function auth(role = 'ADMIN') {
    cy.intercept('**/api/**', { statusCode: 404, body: {} });
    cy.intercept('POST', '**/api/auth/refresh', { access_token: 'TEST_TOKEN' });
    cy.intercept('GET', '**/api/users/me', { id: 1, fullName: 'Admin', role, subscriptionPlan: 'CLASSIC' });
    cy.intercept('POST', '**/api/satisfaction/visit', { prompt: false, canSubmit: false });
  }
  it('affiche les étapes, filtre, pagine et reste lisible sur mobile', () => {
    auth();
    cy.intercept('GET', '**/api/admin/journey*', req => req.reply({ generatedAt: '2026-10-29T10:00:00Z', totals,
      cohorts: [{ ...totals, month: '2026-10' }], total: 25, page: Number(req.query['page'] || 1), pageSize: 20,
      items: [{ id: 7, fullName: 'Camille', createdAt: '2026-10-01', firstActionAt: null, lastActivityAt: null, stage: 'Aucun aquarium' }],
    })).as('report');
    cy.viewport(1280,900); cy.visit('/admin/journey'); cy.wait('@report');
    cy.contains('h1','Parcours utilisateur').should('be.visible');
    cy.get('.headline').should('contain.text','70').and('contain.text','25 %').and('contain.text','5 / 20');
    cy.get('.step').should('have.length',5);
    cy.screenshot('journey-desktop', { capture:'viewport' });
    cy.get('.filters select').select('all'); cy.wait('@report').its('request.url').should('include','days=all');
    cy.get('.review-heading select').select('no_return'); cy.wait('@report').its('request.url').should('include','stage=no_return');
    cy.contains('button','Suivant').click(); cy.wait('@report').its('request.url').should('include','page=2');
    cy.get('a[href="/admin/users/7"]').should('contain.text','Camille');
    cy.viewport(390,844); cy.get('h1').scrollIntoView();
    cy.document().its('documentElement.scrollWidth').should('be.lte',390);
    cy.screenshot('journey-mobile', { capture:'viewport' });
  });
  it('explique une erreur sans afficher des faux zéros et permet de réessayer', () => {
    auth(); cy.intercept('GET','**/api/admin/journey*',{statusCode:503}).as('report');
    cy.visit('/admin/journey'); cy.wait('@report');
    cy.get('[role=alert]').should('contain.text','indisponible'); cy.get('.headline').should('not.exist');
    cy.intercept('GET','**/api/admin/journey*',{generatedAt:'2026-10-29',totals:{...totals,registered:0},cohorts:[],items:[],total:0,page:1,pageSize:20});
    cy.contains('button','Réessayer').click(); cy.get('.headline').should('be.visible'); cy.contains('Aucune inscription').should('exist');
  });
});
