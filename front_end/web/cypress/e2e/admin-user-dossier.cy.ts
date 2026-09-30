/// <reference types="cypress" />
const counts = Object.fromEntries(
  [
    'aquariums',
    'measurements',
    'tasks',
    'ai',
    'fish',
    'plants',
    'targets',
    'health',
    'recommendations',
    'subscriptions',
    'payments',
    'billingActions',
    'activity',
    'achievements',
    'missions',
    'articles',
    'fishCards',
    'plantCards',
  ].map((k) => [k, k === 'measurements' ? 26 : 1]),
);
const dossier = {
  user: {
    id: 2,
    fullName: 'Camille Martin',
    email: 'camille@example.test',
    role: 'USER',
    subscriptionPlan: 'PREMIUM',
    subscriptionStatus: 'active',
    emailVerifiedAt: '2026-09-01',
    createdAt: '2026-08-01',
  },
  settings: { notificationsEnabled: false, theme: 'dark' },
  progress: { level: 4, xp: 340 },
  counts,
  activeSessions: 2,
  archivedAquariums: 1,
  generatedAt: '2026-09-30T12:00:00Z',
};
describe('Dossier administrateur utilisateur', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/api/auth/refresh', { body: { access_token: 'TEST_TOKEN' } });
    cy.intercept('GET', '**/api/users/me', {
      body: { id: 1, fullName: 'Admin', email: 'admin@example.test', role: 'ADMIN' },
    });
    cy.intercept('GET', '**/api/admin/users/2/dossier', { body: dossier }).as('dossier');
    cy.intercept('GET', '**/api/admin/users/2/records/*', (req) => {
      const url = new URL(req.url);
      const section = url.pathname.split('/').pop();
      const page = Number(url.searchParams.get('page') || 1);
      const items =
        section === 'aquariums'
          ? [
              {
                id: 7,
                name: 'Bac amazonien',
                volumeL: 120,
                waterType: 'EAU_DOUCE',
                createdAt: '2026-08-01',
                archivedAt: '2026-09-01',
                archiveExpiresAt: '2027-09-01',
              },
            ]
          : section === 'measurements'
            ? [
                {
                  id: page === 1 ? 30 : 1,
                  aquariumId: 7,
                  aquariumName: 'Bac amazonien',
                  ph: 6.8,
                  measuredAt: '2026-09-29',
                },
              ]
            : section === 'ai'
              ? [
                  {
                    id: 5,
                    feature: 'Bilan',
                    responseText: '<script>alert(1)</script> Eau stable.',
                    createdAt: '2026-09-29',
                  },
                ]
              : section === 'payments'
                ? [{ id: 'pay-1', environment: 'sandbox', paidAt: '2026-09-01', reversed: false }]
                : [];
      req.reply({
        items,
        total: section === 'measurements' ? 26 : items.length,
        page,
        pageSize: 25,
      });
    }).as('records');
  });
  function visit() {
    cy.visit('/admin/users/2');
    cy.wait('@dossier');
    cy.contains('h1', 'Camille Martin').should('be.visible');
    cy.document().then((d) => d.fonts.ready);
  }
  it('organise le compte et les données associées, avec pagination et aquarium masqué', () => {
    cy.viewport(1280, 720);
    visit();
    cy.contains('Sessions non expirées').should('be.visible');
    cy.document().then((d) => expect(d.documentElement.scrollWidth).to.be.at.most(1280));
    cy.screenshot('dossier-desktop', { capture: 'viewport' });
    cy.get('.dossier-navigation').contains('button', 'Aquariums').click();
    cy.wait('@records');
    cy.contains('Aquarium masqué').should('be.visible');
    cy.contains('Suppression prévue').should('be.visible');
    cy.contains('button', 'Voir les mesures de ce bac').click();
    cy.wait('@records').its('request.url').should('include', 'aquariumId=7');
    cy.contains('button', 'Suivant').click();
    cy.wait('@records').its('request.url').should('include', 'page=2');
    cy.contains('page 2 / 2').should('be.visible');
    cy.get('.section-navigation').contains('button', 'IA').click();
    cy.wait('@records');
    cy.get('summary').click();
    cy.contains('<script>alert(1)</script> Eau stable.').should('be.visible');
    cy.get('.dossier-navigation').contains('button', 'Abonnement').click();
    cy.wait('@records');
    cy.get('.section-navigation').contains('button', 'Paiements').click();
    cy.wait('@records');
    cy.contains('Test Sandbox').should('be.visible');
  });
  it('reste lisible sur mobile', () => {
    cy.viewport(390, 844);
    visit();
    cy.document().then((d) => expect(d.documentElement.scrollWidth).to.be.at.most(390));
    cy.screenshot('dossier-mobile', { capture: 'viewport' });
  });
  it('explique un identifiant invalide', () => {
    cy.visit('/admin/users/x');
    cy.contains('Choisissez un utilisateur depuis l’annuaire').should('be.visible');
  });
  it('permet de réessayer après une erreur du dossier', () => {
    cy.intercept('GET', '**/api/admin/users/2/dossier', { statusCode: 500 }).as('failed');
    cy.visit('/admin/users/2');
    cy.wait('@failed');
    cy.contains('Fiche indisponible').should('be.visible');
    cy.intercept('GET', '**/api/admin/users/2/dossier', { body: dossier });
    cy.contains('button', 'Réessayer').click();
    cy.contains('h1', 'Camille Martin').should('be.visible');
  });
});
