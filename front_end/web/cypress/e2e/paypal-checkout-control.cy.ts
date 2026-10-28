/// <reference types="cypress" />
describe('Ouverture des nouvelles souscriptions PayPal', () => {
  it('bloque en rouge, conserve le réglage après rechargement et réactive en vert', () => {
    cy.intercept('**/api/**', { statusCode: 404 });
    cy.intercept('POST', '**/api/auth/refresh', { access_token: 'TEST_TOKEN' });
    cy.intercept('GET', '**/api/users/me', { id: 1, role: 'ADMIN', fullName: 'Admin' });
    cy.intercept('GET', '**/api/admin/subscriptions?*', { items: [], total: 0, configuredEnvironment: 'live' });
    let enabled = true;
    cy.intercept('GET', '**/api/admin/subscriptions/checkout-control', req => req.reply({ enabled, available: true }));
    cy.intercept('PATCH', '**/api/admin/subscriptions/checkout-control', req => {
      enabled = req.body.enabled;
      req.reply({ enabled, available: true });
    }).as('toggle');
    cy.visit('/admin/subscriptions');
    cy.contains('button', 'Souscriptions ouvertes').should('have.class', 'checkout-toggle--open').click();
    cy.wait('@toggle').its('request.body').should('deep.equal', { enabled: false });
    cy.contains('button', 'Souscriptions bloquées').should('have.class', 'checkout-toggle--blocked');
    cy.reload();
    cy.contains('button', 'Souscriptions bloquées').click();
    cy.wait('@toggle').its('request.body').should('deep.equal', { enabled: true });
    cy.contains('button', 'Souscriptions ouvertes').should('have.class', 'checkout-toggle--open');
    cy.viewport(390, 844);
    cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
  });
});
