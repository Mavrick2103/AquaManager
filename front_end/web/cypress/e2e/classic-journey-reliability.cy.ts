/// <reference types="cypress" />
describe('Parcours Classic : continuité et erreurs',()=>{
  const aquarium={id:1,name:'Bac principal',waterType:'EAU_DOUCE',lengthCm:60,widthCm:30,heightCm:35,startDate:'2026-10-01'};
  beforeEach(()=>{
    cy.intercept('**/api/**',{statusCode:404,body:{}});
    cy.intercept('POST','**/api/auth/refresh',{access_token:'TEST_TOKEN'});
    cy.intercept('GET','**/api/users/me',{id:1,fullName:'Camille',email:'camille@example.test',role:'USER',subscriptionPlan:'CLASSIC',subscriptionStatus:'none'});
    cy.intercept('POST','**/api/satisfaction/visit',{prompt:false});
    cy.intercept('GET','**/api/aquariums',[aquarium]);
    cy.intercept('GET','**/api/aquariums/1',aquarium);
    cy.intercept('GET','**/api/aquariums/1/measurements*',[]);
    cy.intercept('GET','**/api/aquariums/1/targets',{profileKey:'FRESH_COMMUNITY',targets:{ph:{min:6.5,max:7.5}}});
    cy.intercept('GET','**/api/tasks*',[]);
    cy.intercept('GET','**/api/billing/paypal/status',{ready:true,premium:false,provider:null,canCancel:false});
    cy.clock(Date.parse('2026-10-29T12:00:00Z'),['Date']);
    cy.viewport(390,844);
  });
  it('valide la même occurrence depuis la fiche et le calendrier sans terminer la série',()=>{
    const date='2026-10-29T09:00:00.000Z';
    const occurrence={id:`r:41:${date}`,title:'Routine du jeudi',dueAt:date,status:'PENDING',type:'OTHER',aquarium:{id:1,name:'Bac principal'},repeat:{mode:'WEEKLY',days:['THU']},seriesDueAt:'2026-10-01T09:00:00.000Z',parentId:41,virtual:true};
    let done=false;
    cy.intercept('GET','**/api/tasks*',req=>req.reply([{...occurrence,status:done?'DONE':'PENDING'}]));
    cy.intercept('PATCH','**/api/tasks/*',req=>{expect(decodeURIComponent(req.url)).to.include(`/tasks/r:41:${date}`);done=true;req.reply({...occurrence,status:'DONE'});}).as('toggle');
    cy.visit('/aquariums/1');cy.contains('[role="tab"]','Tâches').click();
    cy.get('app-aquarium-tasks button[aria-label="Marquer Routine du jeudi comme terminée"]').click();cy.wait('@toggle');
    cy.get('app-aquarium-tasks .task.done').should('contain.text','Routine du jeudi');
    cy.get('app-aquarium-tasks').scrollIntoView();
    cy.document().its('documentElement.scrollWidth').should('be.lte',390);
    cy.screenshot('taches-occurrences-mobile',{capture:'viewport'});
    cy.get('app-aquarium-tasks').contains('button','Gérer le planning').click();
    cy.contains('.cal__task','Routine du jeudi').should('have.class','-done');
  });
  it('garde le deuxième bac dans le planning puis dans la création de tâche',()=>{
    const second={...aquarium,id:2,name:'Deuxième bac'};
    cy.intercept('GET','**/api/aquariums',[aquarium,second]);cy.intercept('GET','**/api/aquariums/2',second);
    cy.visit('/aquariums/2');cy.contains('[role="tab"]','Tâches').click();
    cy.get('app-aquarium-tasks').contains('button','Gérer le planning').click();
    cy.get('.calendar-filters select').first().should('have.value','2');
    cy.contains('button','Nouvelle tâche').click();
    cy.get('mat-select[formControlName="aquariumId"]').should('contain.text','Deuxième bac');
  });
  it('distingue les erreurs des mesures et recommandations puis réessaie',()=>{
    cy.intercept('GET','**/api/aquariums/1/measurements*',{statusCode:503});
    cy.intercept('GET','**/api/recommendations/pending*',{statusCode:503}).as('recos');
    cy.visit('/aquariums/1');cy.contains('[role="alert"]','Impossible de charger les mesures').should('exist');
    cy.contains('Aucune mesure enregistrée').should('not.exist');
    cy.intercept('GET','**/api/aquariums/1/measurements*',[]);
    cy.contains('[role="alert"]','Impossible de charger les mesures').contains('button','Réessayer').click();
    cy.contains('Aucune mesure enregistrée').should('exist');
    cy.contains('[role="tab"]','Solutions').click();cy.wait('@recos');
    cy.contains('Aucune action en attente').should('not.exist');
    cy.intercept('GET','**/api/recommendations/pending*',[]);
    cy.contains('[role="alert"]','Impossible de charger le bilan').contains('button','Réessayer').click();
    cy.contains('Aucune action en attente').should('exist');
  });
  it('bloque les préférences non chargées et conserve les choix récupérés après reprise',()=>{
    cy.intercept('GET','**/api/settings',{statusCode:503}).as('settings');
    cy.intercept('PUT','**/api/settings',req=>req.reply(req.body)).as('save');
    cy.visit('/profile?tab=notifications');cy.wait('@settings');
    cy.contains('button','Enregistrer mes préférences').should('not.exist');
    cy.get('@save.all').should('have.length',0);
    cy.intercept('GET','**/api/settings',{notificationsEnabled:true,emailNotifications:true,pushNotifications:false,taskReminders:false,automaticNotifications:true,newsAndUpdates:true});
    cy.contains('[role="alert"]','Impossible de charger tes préférences').contains('button','Réessayer').click();
    cy.contains('button','Enregistrer mes préférences').click();
    cy.wait('@save').its('request.body').should('include',{notificationsEnabled:true,taskReminders:false,newsAndUpdates:true});
  });
  it('ne confond pas une panne des tâches avec Tout est à jour',()=>{
    cy.intercept('GET','**/api/tasks*',{statusCode:503});
    cy.visit('/aquariums/1');cy.contains('[role="tab"]','Tâches').click();
    cy.get('app-aquarium-tasks [role="alert"]').should('be.visible');
    cy.get('app-aquarium-tasks').should('not.contain.text','Tout est à jour');
    cy.intercept('GET','**/api/tasks*',[]);
    cy.get('app-aquarium-tasks [role="alert"]').contains('button','Réessayer').click();
    cy.get('app-aquarium-tasks').should('contain.text','Tout est à jour');
  });
  it('garde un accueil stable et l’accès au calendrier même avec un entretien prévu',()=>{
    cy.intercept('GET','**/api/tasks*',[{id:'5',title:'Contrôle de novembre',type:'OTHER',status:'PENDING',dueAt:'2026-11-03T09:00:00Z',aquarium:{id:1,name:'Bac principal'}}]);
    cy.visit('/dashboard');
    cy.get('.hero h1').should('have.text','Le suivi de tes aquariums');
    cy.get('.next-action-link').should('not.exist');
    cy.get('.hero').scrollIntoView();
    cy.screenshot('accueil-mobile',{capture:'viewport'});
    cy.get('.hero').contains('button','Calendrier').click();
    cy.location('pathname').should('eq','/calendar');
  });
});
