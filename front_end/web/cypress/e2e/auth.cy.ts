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
    cy.window().then((win) => {
      win.localStorage.clear();
      win.sessionStorage.clear();
    });

    cy.intercept('GET', '**/users/me', {
      statusCode: 401,
      body: { message: 'Unauthorized' },
    }).as('meUnauthorized');

    cy.visit('/');

    cy.wait('@meUnauthorized');

    cy.get('input[formControlName="email"]', { timeout: 10000 }).should('be.visible');
    cy.get('input[formControlName="password"]').should('be.visible');
    cy.get('button[type="submit"]').should('be.visible');

    cy.url().should('include', '/login');
  });
});
