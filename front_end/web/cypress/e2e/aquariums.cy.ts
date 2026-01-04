/// <reference types="cypress" />

const rx = {
  login:   '**/api/auth/login',
  refresh: '**/api/auth/refresh',
  me:      '**/api/users/me',

  aqsAny:  '**/api/aquariums**',         // match large (safe)
  aqById:  (id: number | string) => `**/api/aquariums/${id}**`,

  tasksAny: '**/api/tasks**',
  measuresFor: (id: number | string) => `**/api/aquariums/${id}/measurements**`,
  measuresAny: '**/api/measurements**',
};

function stubSessionBasics() {
  cy.intercept('POST', rx.login,   { statusCode: 200, body: { access_token: 'TEST_TOKEN' } }).as('login');
  cy.intercept('POST', rx.refresh, { statusCode: 200, body: { access_token: 'TEST_TOKEN' } }).as('refresh');
  cy.intercept('GET',  rx.me,      { statusCode: 200, body: { userId: 1, email: 'test@aquamanager.com', role: 'USER' } }).as('me');
}

function uiLogin() {
  stubSessionBasics();

  cy.visit('/login');
  cy.get('input[formControlName="email"]').type('test@aquamanager.com');
  cy.get('input[formControlName="password"]').type('azerty123');
  cy.get('button[type="submit"]').click();

  cy.wait(['@login', '@me']);
  // optionnel mais utile : vérifier qu’on n’est plus sur login
  cy.url().should('not.include', '/login');
}

function visitAquariumsList(body: any[]) {
  cy.intercept('GET', rx.aqsAny, { statusCode: 200, body }).as('aqList');
  cy.visit('/aquariums');
  cy.wait('@aqList');
}

describe('Flow complet AquaManager (création + suppression)', () => {
  beforeEach(() => {
    uiLogin();
  });

  it('crée un aquarium avec succès', () => {
    // 1er GET liste => []
    // 2e GET liste (après création) => [created]
    const created = {
      id: 1,
      name: 'Bac test',
      lengthCm: 70, widthCm: 50, heightCm: 50,
      waterType: 'EAU_DOUCE',
      startDate: '2025-01-01',
      volumeL: 175,
    };

    let listCall = 0;
    cy.intercept('GET', rx.aqsAny, (req) => {
      listCall += 1;
      req.reply({ statusCode: 200, body: listCall === 1 ? [] : [created] });
    }).as('aqListSeq');

    cy.intercept('POST', rx.aqsAny, { statusCode: 201, body: created }).as('createAquarium');

    cy.visit('/aquariums');
    cy.wait('@aqListSeq');

    cy.contains('button, [role="button"]', /nouvel aquarium|créer mon premier aquarium/i, { timeout: 10000 })
      .should('be.visible')
      .click({ force: true });

    cy.get('mat-dialog-container', { timeout: 10000 }).should('be.visible').within(() => {
      cy.get('input[formControlName="name"]').clear().type('Bac test');
      cy.get('input[formControlName="lengthCm"]').clear().type('70');
      cy.get('input[formControlName="widthCm"]').clear().type('50');
      cy.get('input[formControlName="heightCm"]').clear().type('50');
      cy.get('mat-select[formControlName="waterType"]').click();
    });

    cy.contains('.mat-mdc-option, .mat-option', /eau douce/i).click();

    cy.get('mat-dialog-container').within(() => {
      cy.contains('button', /enregistrer/i).click();
    });

    cy.wait('@createAquarium');
    cy.wait('@aqListSeq'); // refresh liste après create

    cy.contains('mat-card-title', 'Bac test', { timeout: 10000 }).should('be.visible');
    cy.contains('mat-card-subtitle', '70×50×50').should('be.visible');
    cy.contains('mat-chip', /eau douce/i).should('exist');
  });

  it('supprime un aquarium existant', () => {
    const aq = {
      id: 2,
      name: 'Aqua à supprimer',
      lengthCm: 60, widthCm: 40, heightCm: 40,
      waterType: 'EAU_DOUCE',
      startDate: '2025-02-01',
      volumeL: 96,
    };

    cy.intercept('GET', rx.aqsAny, { statusCode: 200, body: [aq] }).as('aqList');
    cy.intercept('GET', rx.aqById(2), { statusCode: 200, body: aq }).as('getDetail');
    cy.intercept('GET', rx.measuresFor(2), { statusCode: 200, body: [] }).as('getMeasures');
    cy.intercept('GET', rx.measuresAny,    { statusCode: 200, body: [] }).as('getAllMeasures');

    cy.visit('/aquariums');
    cy.wait('@aqList');

    cy.contains('mat-card-title', /aqua à supprimer/i).click({ force: true });
    cy.wait('@getDetail');

    cy.on('window:confirm', () => true);

    cy.intercept('DELETE', rx.aqById(2), { statusCode: 200, body: { ok: true } }).as('deleteAq');
    cy.intercept('GET', rx.aqsAny, { statusCode: 200, body: [] }).as('listAfterDelete');

    cy.contains('button', /paramètres/i, { timeout: 10000 }).click({ force: true });
    cy.contains('button.mat-mdc-menu-item, button[mat-menu-item], button', /supprimer/i, { timeout: 10000 })
      .click({ force: true });

    cy.wait('@deleteAq');
    cy.wait('@listAfterDelete');
    cy.contains(/vous n’avez pas encore d’aquarium/i).should('exist');
  });
});

describe('Sécurité front — XSS & token', () => {
  beforeEach(() => {
    uiLogin();
  });

  it('bloque l’exécution de scripts (XSS)', () => {
    const payload = `<img src=x onerror="alert('xss')">`;
    const alerts: string[] = [];
    cy.on('window:alert', (txt) => alerts.push(txt));

    cy.intercept('GET',  rx.aqsAny, { statusCode: 200, body: [] }).as('aqListEmpty');
    cy.intercept('POST', rx.aqsAny, { statusCode: 201, body: {
      id: 99, name: payload, lengthCm: 10, widthCm: 10, heightCm: 10, waterType: 'EAU_DOUCE'
    }}).as('createXss');
    cy.intercept('GET',  rx.aqsAny, { statusCode: 200, body: [{
      id: 99, name: payload, lengthCm: 10, widthCm: 10, heightCm: 10, waterType: 'EAU_DOUCE'
    }]}).as('listWithXss');

    cy.visit('/aquariums');
    cy.wait('@aqListEmpty');

    cy.contains('button', /nouvel aquarium|créer mon premier aquarium/i).click({ force: true });

    cy.get('mat-dialog-container').within(() => {
      cy.get('input[formControlName="name"]').type(payload, { parseSpecialCharSequences: false });
      cy.get('mat-select[formControlName="waterType"]').click();
    });
    cy.contains('.mat-mdc-option, .mat-option', /eau douce/i).click();

    cy.get('mat-dialog-container').within(() => {
      cy.contains('button', /créer|enregistrer|valider/i).click();
    });

    cy.wait(['@createXss', '@listWithXss']);

    cy.then(() => expect(alerts, 'aucun alert() déclenché').to.have.length(0));
    // Test plus “réel” : aucun tag img rendu dans le titre
    cy.get('mat-card-title img').should('not.exist');
    // Et le texte est affiché comme texte
    cy.get('mat-card-title').should('contain.text', '<img');
  });

  it('ne stocke PAS le token en localStorage après login', () => {
    // ici tu peux garder ton test tel quel si tu veux
    cy.window().then((win) => {
      expect(win.localStorage.getItem('access_token')).to.be.null;
    });
  });
});
