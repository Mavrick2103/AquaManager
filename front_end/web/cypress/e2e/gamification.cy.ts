/// <reference types="cypress" />
describe('Progression et récompenses', () => {
  it('affiche toutes les missions, les titres et les badges sans débordement mobile', () => {
    cy.intercept('**/api/**', { statusCode: 404, body: {} });
    cy.intercept('POST', '**/api/auth/refresh', { access_token: 'TEST_TOKEN' });
    cy.intercept('GET', '**/api/users/me', { id: 1, fullName: 'Camille', role: 'USER', subscriptionPlan: 'CLASSIC' });
    cy.intercept('GET', '**/api/tasks*', []);
    cy.intercept('GET', '**/api/aquariums*', []);
    cy.intercept('POST', '**/api/satisfaction/visit', { prompt: false, canSubmit: false });
    const titles = ['Garder le contact', 'Des repères dans le temps', 'Garder une trace', 'Anticiper les prochains soins', 'Une routine qui dure', 'Comprendre avant d’agir'];
    cy.intercept('GET', '**/api/gamification/summary', {
      globalScore: 60,
      profile: { xp: 310, level: 3, currentStreak: 3, bestStreak: 7, recentBadgeKey: 'FIRST_MEASUREMENT', xpForCurrentLevel: 300, xpForNextLevel: 550 },
      aquariums: [],
      currentTitle: 'Observateur du bac',
      missions: titles.map((title, i) => ({ id: i + 1, missionKey: `V2_${i}`, title, description: 'Un objectif utile à réaliser à ton rythme, selon les besoins de ton aquarium.', progress: i === 0 ? 3 : 0, target: 3, xpReward: 40, status: i === 0 ? 'COMPLETED' : 'ACTIVE', weekStart: '2026-10-01', weekEnd: '2026-10-31' })),
      achievements: [{ id: 1, achievementKey: 'FIRST_MEASUREMENT', title: 'Première mesure', description: 'Première mesure enregistrée.', unlockedAt: '2026-10-01' }],
      badgeCatalog: [
        { achievementKey: 'FIRST_MEASUREMENT', title: 'Première mesure', description: 'Enregistrer une première mesure.', progress: 1, target: 1, unlockedAt: '2026-10-01' },
        { achievementKey: 'CARE_5_DAYS', title: 'Aux petits soins', description: 'Terminer des tâches sur 5 jours différents.', progress: 2, target: 5, unlockedAt: null },
      ],
      rewards: [{ xp: 0, title: 'Explorateur aquatique', unlocked: true }, { xp: 300, title: 'Observateur du bac', unlocked: true }, { xp: 1000, title: 'Gardien attentif', unlocked: false }],
    });
    cy.viewport(1280, 900);
    cy.visit('/dashboard');
    cy.get('.gm-mission').should('have.length', 6);
    cy.get('.gm-earned-title').should('contain.text', 'Observateur du bac');
    cy.contains('.gm-mission', 'Garder le contact').should('contain.text', 'Gagnés : 40 XP');
    cy.contains('summary', 'Ma collection').click();
    cy.contains('.gm-collection article', 'Aux petits soins').should('contain.text', '2 / 5');
    cy.contains('summary', 'Les titres').click();
    cy.contains('.gm-collection article', 'Gardien attentif').should('contain.text', 'À débloquer');
    cy.get('.gm-hero-card').scrollIntoView();
    cy.screenshot('progression-desktop', { capture: 'viewport' });
    cy.viewport(390, 844);
    cy.get('.gm-hero-card').scrollIntoView();
    cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
    cy.screenshot('progression-mobile', { capture: 'viewport' });
    cy.contains('.gm-mission', 'Comprendre avant d’agir').scrollIntoView().should('be.visible');
    cy.contains('a', 'Choisir un aquarium pour poursuivre').click();
    cy.location('pathname').should('eq', '/aquariums');
  });
});
