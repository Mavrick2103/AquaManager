/// <reference types="cypress" />
const prefs = {
  notificationsEnabled: true,
  emailNotifications: true,
  pushNotifications: false,
  taskReminders: true,
  automaticNotifications: false,
  newsAndUpdates: false,
};
function setup(role = 'USER', premium = false) {
  cy.intercept('**/api/**', { statusCode: 404, body: {} });
  cy.intercept('POST', '**/api/auth/refresh', { access_token: 'TEST_TOKEN' });
  const me = {
    id: 1,
    fullName: 'Camille Martin',
    email: 'camille@example.test',
    role,
    subscriptionPlan: premium ? 'PREMIUM' : 'CLASSIC',
    subscriptionStatus: premium ? 'active' : 'none',
    subscriptionEndsAt: premium ? '2099-11-01' : null,
  };
  cy.intercept('GET', '**/api/users/me', me).as('me');
  cy.intercept('GET', '**/api/settings', prefs).as('settings');
  cy.intercept('GET', '**/api/billing/paypal/status', {
    ready: true,
    provider: premium ? 'paypal' : null,
    status: premium ? 'ACTIVE' : null,
    premium,
    canCancel: premium,
    paidUntil: premium ? '2099-11-01' : null,
  });
  cy.intercept('POST', '**/api/auth/logout', { ok: true });
  cy.viewport(1280, 800);
  return me;
}
function ready(url = '/profile') {
  cy.visit(url);
  cy.wait('@settings');
  cy.document().then((d) => d.fonts.ready);
}
function section(label: string) {
  cy.contains('nav[aria-label="Rubriques des paramètres"] button', label).click();
}
describe('Profil et paramètres organisés', () => {
  it('enregistre uniquement les informations personnelles et conserve les brouillons entre rubriques', () => {
    const me = setup();
    cy.intercept('PUT', '**/api/users/me', (req) => req.reply({ ...me, ...req.body })).as('save');
    ready();
    cy.get('#fullName').clear().type('Camille Dupont');
    section('Sécurité');
    section('Mon compte');
    cy.get('#fullName').should('have.value', 'Camille Dupont');
    cy.contains('button', 'Enregistrer les modifications').click();
    cy.wait('@save').its('request.body').should('deep.equal', { fullName: 'Camille Dupont' });
    cy.get('.account-summary').should('contain.text', 'Camille Dupont');
    cy.document().its('documentElement.scrollWidth').should('be.lte',1280);
    cy.scrollTo('top');
    cy.screenshot('profile-account', { capture: 'viewport' });
  });
  it('demande le mot de passe pour changer d’email', () => {
    const me = setup();
    cy.intercept('PUT', '**/api/users/me', me).as('save');
    ready();
    cy.get('#email').clear().type('nouveau@example.test');
    cy.contains('button', 'Enregistrer les modifications').should('be.disabled');
    cy.get('input[formControlName=currentPassword]').type('AncienSecret!');
    cy.contains('button', 'Enregistrer les modifications').click();
    cy.wait('@save')
      .its('request.body')
      .should('deep.equal', { email: 'nouveau@example.test', currentPassword: 'AncienSecret!' });
    cy.contains('Un lien de confirmation a été envoyé').should('be.visible');
    cy.get('#email').should('have.value', me.email);
  });
  it('sépare la modification du mot de passe des autres champs', () => {
    setup();
    cy.intercept('PUT', '**/api/users/me', { statusCode: 500 }).as('profileWrite');
    cy.intercept('POST', '**/api/users/me/password', { ok: true }).as('password');
    ready();
    cy.get('#fullName').clear().type('Brouillon non enregistré');
    section('Sécurité');
    cy.contains('button', 'Modifier le mot de passe').should('be.disabled');
    cy.get('input[formControlName=currentPassword]').type('AncienSecret!');
    cy.get('input[formControlName=newPassword]').type('NouveauSecret!');
    cy.get('.danger-card').should('not.have.attr', 'open');
    cy.screenshot('profile-security', { capture: 'viewport' });
    cy.contains('button', 'Modifier le mot de passe').click();
    cy.wait('@password')
      .its('request.body')
      .should('deep.equal', { currentPassword: 'AncienSecret!', newPassword: 'NouveauSecret!' });
    cy.get('@profileWrite.all').should('have.length', 0);
    cy.location('pathname').should('eq', '/login');
  });
  it('conserve le lien direct vers l’abonnement et la confirmation de résiliation', () => {
    setup('USER', true);
    cy.intercept('POST', '**/api/billing/paypal/cancel', { ok: true }).as('cancel');
    ready('/profile?tab=subscription');
    cy.contains('h2', 'Gérer mon abonnement').should('be.visible');
    cy.on('window:confirm', (message) => {
      expect(message).to.include('conservés un an');
      return false;
    });
    cy.contains('button', 'Arrêter le renouvellement PayPal').click();
    cy.get('@cancel.all').should('have.length', 0);
    cy.screenshot('profile-subscription', { capture: 'viewport' });
  });
  it('enregistre les notifications et présente des rubriques lisibles sur mobile', () => {
    setup();
    cy.intercept('PUT', '**/api/settings', (req) => req.reply(req.body)).as('savePrefs');
    ready('/profile?tab=notifications');
    cy.viewport(390, 844);
    cy.get('button[role="switch"][aria-label="Nouveautés et mises à jour"]').click();
    cy.contains('button', 'Enregistrer mes préférences').click();
    cy.wait('@savePrefs')
      .its('request.body')
      .should('include', {
        newsAndUpdates: true,
        emailNotifications: true,
        pushNotifications: false,
      });
    for (const label of ['Mon compte', 'Abonnement', 'Sécurité', 'Avis & aide']) {
      section(label);
      cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
    }
    cy.intercept('GET', '**/api/satisfaction', {
      segment: 'CLASSIC',
      canSubmit: true,
      prompt: false,
      nextResponseAt: null,
    });
    cy.contains('button', 'Donner mon avis').click();
    cy.get('app-satisfaction form').should('be.visible');
    section('Mon compte');
    cy.get('.section-heading').scrollIntoView();
    cy.screenshot('profile-mobile', { capture: 'viewport' });
  });
  it('sépare les accès de l’équipe des réglages personnels', () => {
    setup('ADMIN');
    ready();
    cy.contains('a', 'Ouvrir l’administration').should('have.attr', 'href', '/admin/metrics');
    setup('EDITOR');
    ready();
    cy.contains('a', 'Ouvrir l’administration').should('not.exist');
    cy.get('.team-access a').should('have.length', 3);
  });
});
