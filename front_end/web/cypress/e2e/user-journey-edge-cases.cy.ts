/// <reference types="cypress" />
describe('Parcours utilisateur : validations et dates', () => {
  function setup() {
    cy.intercept('**/api/**',{statusCode:404,body:{}});
    cy.intercept('POST','**/api/auth/refresh',{access_token:'TEST_TOKEN'});
    cy.intercept('GET','**/api/users/me',{id:1,fullName:'Camille',role:'USER',subscriptionPlan:'CLASSIC'});
    cy.intercept('POST','**/api/satisfaction/visit',{prompt:false,canSubmit:true});
    cy.intercept('GET','**/api/tasks*',[]);
    cy.intercept('GET','**/api/aquariums*',[{id:1,name:'Bac principal'}]);
    cy.intercept('GET','**/api/aquariums/retention-status',{archivedCount:0,nextDeletionAt:null});
    cy.intercept('POST','**/api/tasks',req=>req.reply({id:50,...req.body})).as('save');
  }
  function choose(control:string,label:string) {
    cy.get(`mat-select[formControlName="${control}"]`).click();
    cy.contains('.mat-mdc-option',label).click();
  }
  it('enregistre après avoir quitté une fertilisation incomplète', () => {
    setup();cy.visit('/calendar');cy.contains('button','Nouvelle tâche').click();
    choose('type','Fertilisation');
    cy.get('[formArrayName="fertilizers"] input[formControlName="name"]').should('exist');
    choose('type','Changement d’eau');
    cy.get('[formArrayName="fertilizers"]').should('not.exist');
    cy.get('mat-dialog-container').contains('button','Enregistrer').click();
    cy.wait('@save').its('request.body').should('include',{type:'WATER_CHANGE',fertilization:null});
  });
  it('enregistre après annulation d’une répétition dont la durée était invalide', () => {
    setup();cy.visit('/calendar');cy.contains('button','Nouvelle tâche').click();
    choose('type','Changement d’eau');
    cy.get('mat-slide-toggle[formControlName="isRepeat"] button[role="switch"]').click().should('have.attr','aria-checked','true');
    cy.get('mat-slide-toggle[formControlName="repeatHasEnd"] button[role="switch"]').click().should('have.attr','aria-checked','true');
    cy.get('input[formControlName="repeatDurationWeeks"]').clear().type('0').blur();
    choose('repeatMode','Aucune');
    cy.get('input[formControlName="repeatDurationWeeks"]').should('not.exist');
    cy.get('mat-dialog-container').contains('button','Enregistrer').click();
    cy.wait('@save').its('request.body.repeat').should('eq',null);
  });
  it('classe la tâche au jour local et conserve les prochaines tâches au changement de mois', () => {
    setup();cy.clock(Date.parse('2026-10-29T12:00:00Z'),['Date']);
    const night={id:'1',title:'Contrôle après minuit',type:'WATER_TEST',status:'PENDING',dueAt:new Date(2026,9,29,0,30).toISOString()};
    const next={id:'2',title:'Entretien novembre',type:'OTHER',status:'PENDING',dueAt:new Date(2026,10,3,9).toISOString()};
    cy.intercept('GET','**/api/tasks*',[night,next]);
    cy.visit('/calendar');
    cy.get('.cal__cell').filter((_,cell)=>cell.querySelector('.cal__day')?.textContent?.trim()==='29')
      .should('contain.text','Contrôle après minuit');
    cy.contains('.summary-card','7 prochains jours').find('strong').should('have.text','1');
    cy.contains('.summary-card','À faire aujourd’hui').find('strong').should('have.text','1');
    cy.get('button[aria-label="Mois suivant"]').click();
    cy.get('.cal__title').should('contain.text','Novembre');
    cy.contains('.cal__task','Entretien novembre').should('exist');
    cy.contains('.summary-card','7 prochains jours').find('strong').should('have.text','1');
  });
  it('ne présente pas une panne comme un premier aquarium et récupère sur Réessayer', () => {
    setup();cy.intercept('GET','**/api/aquariums/overview',{statusCode:503});
    cy.visit('/aquariums');
    cy.get('.aquariums-load-error').should('be.visible');
    cy.get('.empty-state').should('not.exist');
    cy.get('[data-tour="aquarium-create"]').should('be.disabled');
    cy.intercept('GET','**/api/aquariums/overview',[]);
    cy.get('.aquariums-load-error').contains('button','Réessayer').click();
    cy.get('.empty-state').should('be.visible');
    cy.get('[data-tour="aquarium-create"]').should('not.be.disabled');
  });
});
