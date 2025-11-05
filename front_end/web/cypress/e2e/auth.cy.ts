/// <reference types="cypress" />

describe('Authentification', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/auth/login', {
      statusCode: 200,
      body: { access_token: 'TEST_TOKEN' },
    }).as('login');
    cy.intercept('GET', '**/users/me', {
      statusCode: 200,
      body: { id: 1, email: 'test@aquamanager.com' },
    }).as('me');
  });

  it('doit permettre la connexion', () => {
    cy.visit('/login');
    cy.get('input[formControlName="email"]').type('test@aquamanager.com');
    cy.get('input[formControlName="password"]').type('Azerty123');
    cy.get('button[type="submit"]').click();

    cy.wait('@login');
    cy.wait('@me');

    cy.contains('Mes aquariums').should('be.visible');
  });

  it('empêche un accès non connecté au dashboard', () => {
    cy.clearCookies();
    cy.visit('/');
    cy.url().should('include', '/login');
  });
});
