/// <reference types="cypress" />

describe('Mesures et graphiques - AquaManager', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/api/auth/refresh', {
      statusCode: 200,
      body: { access_token: 'TEST_TOKEN' },
    }).as('refresh');

    cy.intercept('GET', '**/api/users/me', {
      statusCode: 200,
      body: { userId: 1, email: 'test@aquamanager.com', role: 'USER' },
    }).as('me');

    cy.intercept('GET', '**/api/aquariums/1', {
      statusCode: 200,
      body: {
        id: 1,
        name: 'Bac principal',
        lengthCm: 70,
        widthCm: 30,
        heightCm: 35,
        waterType: 'EAU_DOUCE',
        startDate: '2025-01-01',
        volumeL: 73,
        createdAt: '2025-01-01T00:00:00Z',
      },
    }).as('aq1');

    cy.intercept('GET', '**/api/aquariums/1/measurements*', {
      statusCode: 200,
      body: [],
    }).as('measList');

    cy.visit('/aquariums/1');
    cy.wait(['@refresh', '@me', '@aq1', '@measList']);
  });

 
  it('ajoute une mesure d’eau', () => {
    cy.intercept('POST', '**/api/aquariums/1/measurements*', (req) => {
      const idFromUrl = Number(req.url.match(/\/aquariums\/(\d+)\//)?.[1]);
      expect(idFromUrl, 'ID aquarium dans l’URL').to.equal(1);
      expect(req.body).to.have.property('ph');
      expect(req.body).to.have.property('temp');


      req.reply({
        statusCode: 201,
        body: {
          id: 999,
          aquariumId: 1,
          measuredAt: new Date().toISOString(),
          ph: Number(req.body.ph) ?? 7.2,
          temp: Number(req.body.temp) ?? 25,
        },
      });
    }).as('createMeasurement');

    cy.intercept('GET', '**/api/aquariums/1/measurements*', {
      statusCode: 200,
      body: [
        {
          id: 999,
          aquariumId: 1,
          measuredAt: new Date().toISOString(),
          ph: 7.2,
          temp: 25,
        },
      ],
    }).as('measListAfter');

    cy.contains('button', /ajouter une mesure/i, { timeout: 10000 }).click({ force: true });
    cy.get('mat-dialog-container', { timeout: 10000 }).within(() => {
      cy.get('input[formControlName="ph"]').clear().type('7.2', { force: true });
      cy.get('input[formControlName="temp"]').clear().type('25', { force: true });
      cy.contains('button', /enregistrer/i, { timeout: 10000 }).click({ force: true });
    });
    cy.wait('@createMeasurement');
    cy.contains('Paramètres enregistrés', { timeout: 10000 }).should('be.visible');
  });

  
  it('affiche les graphiques des paramètres', () => {
    cy.get('.mini-grid', { timeout: 10000 }).should('exist');
    cy.get('app-water-measurements-chart').its('length').should('be.greaterThan', 0);
    cy.get('app-water-measurements-chart[metric="ph"]').should('exist');
    cy.get('app-water-measurements-chart[metric="temp"]').should('exist');
  });

  
it('bloque les tentatives XSS dans les mesures', () => {
  const payload = `<img src=x onerror="alert('xss')">`;
  const alerts: string[] = [];
  cy.on('window:alert', (txt) => alerts.push(txt));

  cy.intercept('GET', '**/api/aquariums/1/measurements*', {
    statusCode: 200,
    body: [
      {
        id: 999,
        aquariumId: 1,
        measuredAt: new Date().toISOString(),
        ph: payload,
        temp: 25,
      },
    ],
  }).as('measListXss');

  cy.reload();
  cy.wait('@measListXss');
  cy.then(() => expect(alerts, 'aucun alert() déclenché').to.have.length(0));
  cy.get('img[src="x"]').should('not.exist');
  cy.document().then((doc) => {
    expect(doc.body.innerHTML).to.not.include(payload);
  });
});
});
