/// <reference types="cypress" />
describe('TDS et conductivité',()=>{
  let readings:any[];
  beforeEach(()=>{
    readings=[{id:1,aquariumId:1,measuredAt:new Date().toISOString(),ph:7,temp:24,tds:150,conductivity:300}];
    cy.intercept('**/api/**',{statusCode:404,body:{}});
    cy.intercept('POST','**/api/auth/refresh',{access_token:'TEST_TOKEN'});
    cy.intercept('GET','**/api/users/me',{id:1,role:'USER',subscriptionPlan:'CLASSIC',subscriptionStatus:'none'});
    cy.intercept('POST','**/api/satisfaction/visit',{prompt:false});
    cy.intercept('GET','**/api/aquariums/1',{id:1,name:'Bac crevettes',waterType:'EAU_DOUCE',lengthCm:60,widthCm:30,heightCm:35});
    cy.intercept('GET','**/api/aquariums/1/measurements*',req=>req.reply(readings)).as('readings');
    cy.intercept('GET','**/api/aquariums/1/targets',{profileKey:'FRESH_SHRIMP',targets:{ph:{min:6.5,max:7.5}}});
    cy.intercept('GET','**/api/aquariums/1/fish',[]);cy.intercept('GET','**/api/aquariums/1/plants',[]);
    cy.intercept('GET','**/api/tasks*',[]);
    cy.intercept('POST','**/api/aquariums/1/measurements',req=>{
      const measurement={id:2,aquariumId:1,...req.body};readings=[measurement];
      req.reply({measurement,recommendations:[]});
    }).as('save');
    cy.viewport(390,844);
  });
  function open(){cy.visit('/aquariums/1');cy.wait('@readings');cy.contains('button','Ajouter une mesure').click();cy.contains('Valeurs reprises du relevé').should('exist');}
  it('préremplit, enregistre zéro et une décimale, puis affiche les deux unités sans seuil inventé',()=>{
    open();
    cy.get('input[formControlName="tds"]').should('have.value','150').clear().type('0');
    cy.get('input[formControlName="conductivity"]').should('have.value','300').clear().type('324.5');
    cy.get('mat-dialog-container').contains('button','Enregistrer').click();
    cy.wait('@save').its('request.body').should('include',{tds:0,conductivity:324.5});
    cy.get('.history-entry').should('contain.text','TDS').and('contain.text','ppm').and('contain.text','Conductivité').and('contain.text','µS/cm');
    cy.contains('mat-expansion-panel-header',/Équilibre/).click();
    cy.contains('app-water-measurements-chart','TDS').should('contain.text','ppm').and('contain.text','Objectif non défini');
    cy.contains('app-water-measurements-chart','Conductivité').should('contain.text','µS/cm').and('contain.text','Objectif non défini');
    cy.contains('app-water-measurements-chart','TDS').scrollIntoView().click();
    cy.get('mat-dialog-container').should('contain.text','TDS');
    cy.get('mat-dialog-container button[aria-label="Fermer"]').click();
  });
  it('ne remplit pas les valeurs historiques absentes et ne convertit pas le TDS en conductivité',()=>{
    readings=[{id:1,aquariumId:1,measuredAt:new Date().toISOString(),ph:7,temp:24}];
    cy.visit('/aquariums/1');cy.wait('@readings');
    cy.contains('app-water-measurements-chart','TDS').should('not.exist');
    cy.contains('button','Ajouter une mesure').click();cy.contains('Valeurs reprises du relevé').should('exist');
    cy.get('input[formControlName="tds"]').should('have.value','').type('160');
    cy.get('input[formControlName="conductivity"]').should('have.value','');
    cy.get('mat-dialog-container').contains('button','Enregistrer').click();
    cy.wait('@save').its('request.body').should('include',{tds:160,conductivity:null});
  });
  it('explique une valeur négative et conserve les actions accessibles sur mobile',()=>{
    open();cy.get('input[formControlName="tds"]').clear().type('-1').blur();
    cy.contains('La valeur minimale est 0').should('be.visible');
    cy.get('mat-dialog-container').contains('button','Enregistrer').should('be.disabled');
    cy.get('input[formControlName="tds"]').clear().type('160').blur();
    cy.get('mat-dialog-container').contains('button','Enregistrer').should('not.be.disabled').then(button=>{
      const rect=button[0].getBoundingClientRect();expect(rect.bottom).to.be.lte(844);expect(rect.top).to.be.gte(0);
    });
    cy.get('input[formControlName="conductivity"]').scrollIntoView();
    cy.document().its('documentElement.scrollWidth').should('be.lte',390);
    cy.screenshot('mesures-mineralisation-mobile',{capture:'viewport'});
  });
});
