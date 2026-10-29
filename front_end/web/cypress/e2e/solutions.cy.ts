/// <reference types="cypress" />
describe('Solutions : parcours guidé', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/api/auth/refresh', { access_token: 'TEST_TOKEN' });
    cy.intercept('GET', '**/api/users/me', { id: 1, email: 'test@example.test', role: 'USER' });
    cy.intercept('GET', '**/api/aquariums/1', { id: 1, name: 'Bac principal', waterType: 'EAU_DOUCE', volumeL: 63, lengthCm: 60, widthCm: 30, heightCm: 35 });
    cy.intercept('GET', '**/api/aquariums/1/measurements*', []);
    cy.intercept('GET', '**/api/aquariums/1/fish', []);
    cy.intercept('GET', '**/api/aquariums/1/plants', []);
    cy.intercept('GET', '**/api/aquariums/1/targets', { profileKey: 'FRESH_COMMUNITY', targets: { ph: { min: 6.5, max: 7.5 } } });
    cy.intercept('GET', '**/api/recommendations/pending*', []).as('recommendations');
    cy.intercept('POST', '**/api/ai/**', { statusCode: 500 }).as('paidAnalysis');
    cy.viewport(1280, 720);
    cy.visit('/aquariums/1');
    cy.document().then(d => d.fonts.ready);
    cy.contains('[role="tab"]', 'Solutions').click();
    cy.wait('@recommendations');
  });
  it('ouvre le bilan, replie les objectifs et guide vers la première mesure', () => {
    cy.get('#assistant-panel').should('be.visible');
    cy.contains('Une première mesure pour commencer').should('be.visible');
    cy.get('.solution-reference').should('not.have.attr', 'open');
    cy.get('.solution-reference summary').click();
    cy.get('.solution-reference').should('have.attr', 'open');
    cy.get('.solution-reference summary').click();
    cy.get('.solution-choice-heading').scrollIntoView();
    cy.screenshot('solutions-desktop', { capture: 'viewport' });
    cy.get('.solution-summary').contains('button', 'Ajouter une mesure').click();
    cy.contains('[role="dialog"]', 'Nouvelle mesure d’eau').should('be.visible');
    cy.contains('button', 'Annuler').click();
    cy.get('@paidAnalysis.all').should('have.length', 0);
  });
  it('conserve la découverte Premium accessible et reste lisible sur mobile', () => {
    cy.viewport(390, 844);
    cy.get('#ai-tab').click();
    cy.contains('button', 'Découvrir Premium').should('be.visible').and('not.be.disabled');
    cy.get('@paidAnalysis.all').should('have.length', 0);
    cy.get('#assistant-tab').click();
    cy.get('.solution-choice-heading').scrollIntoView();
    cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
    cy.screenshot('solutions-mobile', { capture: 'viewport' });
  });

  for (const scenario of [
    { name: 'partielles', measurement: { measuredAt: new Date().toISOString(), ph: 7 }, expected: 'Aucun écart détecté parmi les paramètres évalués' },
    { name: 'absentes', measurement: { measuredAt: new Date().toISOString(), ph: null }, expected: 'Données insuffisantes' },
    { name: 'anciennes', measurement: { measuredAt: new Date(Date.now() - 16 * 86400000).toISOString(), ph: 7 }, expected: 'Un relevé récent est nécessaire' },
  ]) {
    it(`nuance le bilan avec des valeurs ${scenario.name}`, () => {
      cy.intercept('GET', '**/api/aquariums/1/measurements*', [{ id: 1, aquariumId: 1, ...scenario.measurement }]);
      cy.visit('/aquariums/1');
      cy.contains('[role="tab"]', 'Solutions').click();
      cy.wait('@recommendations');
      cy.get('#assistant-panel').should('contain.text', scenario.expected);
      cy.contains('Bac en bonne santé').should('not.exist');
      cy.contains('Rien à faire').should('not.exist');
      if (scenario.name === 'partielles') cy.get('.health-card').should('contain.text', '1 paramètre(s) évalué(s)').and('contain.text', 'Les valeurs absentes ne sont pas évaluées');
      else cy.get('.health-card').should('not.exist');
    });
  }
});
