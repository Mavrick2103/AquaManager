/// <reference types="cypress" />

describe('Authentification', () => {
  beforeEach(() => {
    // Stubs communs pour le scénario "login OK"
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
    // On simule vraiment un utilisateur NON connecté
    cy.clearCookies();
    cy.window().then((win) => {
      win.localStorage.clear();
      win.sessionStorage.clear();
    });

    // Ici on n’a pas besoin de stubber login/me : on ne veut justement PAS être authentifié
    cy.visit('/');

    // 👉 Ce qui compte : pas de dashboard visible…
    cy.contains('Mes aquariums').should('not.exist');

    // …et on voit bien le formulaire de login (ou au moins les champs)
    cy.get('input[formControlName="email"]').should('be.visible');
    cy.get('input[formControlName="password"]').should('be.visible');
    cy.get('button[type="submit"]').should('be.visible');
  });
});
