/// <reference types="cypress" />
describe('Administration des contenus', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/api/auth/refresh', { body: { access_token: 'TEST_TOKEN' } });
    cy.intercept('GET', '**/api/users/me', {
      body: { id: 1, fullName: 'Admin', email: 'admin@example.test', role: 'ADMIN' },
    });
    for (const kind of ['fish', 'plant'])
      cy.intercept('GET', `**/api/admin/${kind}-cards*`, {
        body: [
          {
            id: 1,
            commonName: kind === 'fish' ? 'Néon bleu' : 'Anubias',
            scientificName: kind === 'fish' ? 'Paracheirodon innesi' : 'Anubias barteri',
            waterType: 'EAU_DOUCE',
            status: 'APPROVED',
            minVolumeL: 80,
            maxSizeCm: 4,
            createdAt: '2026-09-30',
          },
          {
            id: 2,
            commonName: 'Fiche en attente',
            waterType: 'EAU_DOUCE',
            status: 'PENDING',
            createdAt: '2026-09-29',
          },
        ],
      }).as(kind);
    cy.intercept('GET', '**/api/admin/articles/themes', { body: [{ id: 1, name: 'Entretien' }] });
    cy.intercept('GET', /\/api\/admin\/articles(?:\?|$)/, (req) => {
      const status = new URL(req.url).searchParams.get('status');
      const data = [
        {
          id: 1,
          title: 'Bien entretenir son aquarium',
          excerpt: 'Les gestes essentiels pour un aquarium équilibré.',
          status: 'PUBLISHED',
          themeId: 1,
          uniqueViewsPeriod: 12,
        },
        { id: 2, title: 'Préparer les premières mesures', status: 'DRAFT', themeId: 1 },
      ];
      req.reply(data.filter((a) => !status || a.status === status));
    }).as('articles');
  });
  for (const kind of ['fish', 'plant'])
    it(`filtre et ouvre les formulaires ${kind}, ordinateur et mobile`, () => {
      cy.viewport(1280, 720);
      cy.visit(`/admin/species/${kind}`);
      cy.wait('@' + kind);
      cy.document().then((d) => d.fonts.ready);
      cy.get('.grid .card').should('have.length', 2);
      cy.screenshot(`contents-${kind}`, { capture: 'viewport' });
      cy.get('.catalog-filters select').select('PENDING');
      cy.get('.grid .card').should('have.length', 1).and('contain', 'Fiche en attente');
      cy.contains('button', 'Réinitialiser').click();
      cy.get('.grid .card').should('have.length', 2);
      cy.get('.grid .card').first().contains('button', 'Modifier').click();
      cy.get('input[formControlName=commonName]').should('not.have.value', '');
      cy.get('.hero-actions').contains('button', 'Nouvelle fiche').click();
      cy.get('input[formControlName=commonName]').should('have.value', '');
      cy.viewport(390, 844);
      cy.document().then((d) => expect(d.documentElement.scrollWidth).to.be.at.most(390));
      cy.screenshot(`contents-${kind}-mobile-form`, { capture: 'viewport' });
      cy.get('[role=tab]').contains('Liste').click();
      cy.get('.grid .card').should('have.length', 2);
      cy.document().then((d) => expect(d.documentElement.scrollWidth).to.be.at.most(390));
      cy.screenshot(`contents-${kind}-mobile`, { capture: 'viewport' });
    });
  it('filtre les articles et ouvre la création sur mobile', () => {
    cy.viewport(1280, 720);
    cy.visit('/admin/articles');
    cy.wait('@articles');
    cy.document().then((d) => d.fonts.ready);
    cy.get('.grid .card').should('have.length', 2);
    cy.screenshot('contents-articles', { capture: 'viewport' });
    cy.get('.catalog-filters select').first().select('DRAFT');
    cy.wait('@articles');
    cy.get('.grid .card').should('have.length', 1);
    cy.contains('button', 'Réinitialiser').click();
    cy.wait('@articles');
    cy.get('.grid .card').should('have.length', 2);
    cy.viewport(390, 844);
    cy.document().then((d) => expect(d.documentElement.scrollWidth).to.be.at.most(390));
    cy.screenshot('contents-articles-mobile', { capture: 'viewport' });
    cy.contains('button', 'Nouvel article').click();
    cy.get('input[formControlName=title]').should('be.visible');
    cy.document().then((d) => expect(d.documentElement.scrollWidth).to.be.at.most(390));
  });
});
