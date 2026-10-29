/// <reference types="cypress" />
describe('Parcours utilisateur : démarrage et entretien', () => {
  function auth() {
    cy.intercept('**/api/**', {statusCode:404,body:{}});
    cy.intercept('POST','**/api/auth/refresh',{access_token:'TEST_TOKEN'});
    cy.intercept('GET','**/api/users/me',{id:1,fullName:'Camille',role:'USER',subscriptionPlan:'CLASSIC'});
    cy.intercept('POST','**/api/satisfaction/visit',{prompt:false,canSubmit:true});
    cy.intercept('GET','**/api/aquariums*',[]);
    cy.intercept('GET','**/api/tasks*',[]);
  }
  const task = (id:number, dueAt:string, status='PENDING') => ({id,title:`Entretien ${id}`,dueAt,status,type:'WATER_CHANGE'});
  it('compte toutes les prochaines tâches au-delà du mois et recharge les semaines', () => {
    auth(); cy.clock(Date.parse('2026-10-29T12:00:00Z'),['Date']);
    const november = Array.from({length:8},(_,i)=>task(i+1,`2026-11-03T09:${String(i).padStart(2,'0')}:00Z`));
    cy.intercept('GET','**/api/tasks*',req=>req.reply(req.query['month']==='2026-11' ? november : [task(20,'2026-10-20T09:00:00Z'),task(21,'2026-10-29T15:00:00Z','DONE')])).as('tasks');
    cy.visit('/dashboard');
    cy.contains('.kpi','À faire dans les 7 prochains jours').find('.kpi-value').should('have.text','8');
    cy.contains('.kpi','À faire aujourd’hui').find('.kpi-value').should('have.text','0');
    cy.contains('.kpi','En retard ce mois-ci').find('.kpi-value').should('have.text','1');
    cy.contains('section.activity','Activités à venir').find('li').should('have.length',5);
    cy.get('app-user-navigation a').should('have.length',4);
    cy.get('button[aria-label="Semaine suivante"]').click();
    cy.get('app-week-calendar').should('contain.text','Entretien 1');
    cy.viewport(390,844);cy.get('.grid').scrollIntoView();
    cy.document().its('documentElement.scrollWidth').should('be.lte',390);
    cy.screenshot('home-tasks-mobile',{capture:'viewport'});
    cy.get('app-user-navigation').scrollIntoView({offset:{top:-80,left:0}});
    cy.screenshot('navigation-mobile',{capture:'viewport'});
  });
  it('distingue les erreurs des états vides et réessaie', () => {
    auth();cy.intercept('GET','**/api/tasks*',{statusCode:503}).as('error');
    cy.intercept('GET','**/api/aquariums*',{statusCode:503});
    cy.visit('/dashboard');
    cy.contains('.home-load-error','Impossible de charger les entretiens').should('be.visible');
    cy.contains('.kpi','À faire aujourd’hui').find('.kpi-value').should('have.text','—');
    cy.get('.activity-grid').should('not.exist');
    cy.get('app-week-calendar [role=alert]').should('exist');
    cy.intercept('GET','**/api/tasks*',[]);
    cy.contains('.home-load-error','Impossible de charger les entretiens').contains('button','Réessayer').click();
    cy.get('.activity-grid').should('exist');
    cy.contains('Aucun entretien à faire').should('exist');
  });
  it('garde la confirmation email visible et permet le renvoi après inscription', () => {
    cy.intercept('**/api/**',{statusCode:404,body:{}});
    cy.intercept('POST','**/api/auth/register',{message:'Compte créé'}).as('register');
    cy.intercept('POST','**/api/auth/resend-verification',{message:'Lien envoyé'}).as('resend');
    cy.visit('/register');
    cy.get('input[formControlName="fullName"]').type('Camille');
    cy.get('input[formControlName="email"]').type('camille@example.test');
    cy.get('input[formControlName="password"]').type('Password123!');
    cy.contains('mat-label','Confirmer le mot de passe').click();
    cy.get('input[formControlName="confirmPassword"]').type('Password123!');
    cy.contains('mat-checkbox','J’accepte').click();
    cy.contains('button','Créer mon compte').click();cy.wait('@register');
    cy.location('pathname').should('eq','/login');
    cy.get('.registration-confirmation').should('contain.text','camille@example.test');
    cy.reload();cy.get('.registration-confirmation').should('be.visible');
    cy.get('.registration-confirmation button').click();cy.wait('@resend');
  });
  it('guide la tâche depuis le choix du bac et distingue un aquarium absent', () => {
    auth();cy.intercept('GET','**/api/aquariums*',[{id:2,name:'Bac principal'}]);
    cy.viewport(390,844);
    cy.visit('/calendar');cy.contains('button','Nouvelle tâche').click();
    cy.get('mat-dialog-container').within(()=>{
      cy.get('mat-select').first().should('have.attr','formControlName','aquariumId');
      cy.get('mat-select[formControlName="type"]').click();
    });
    cy.contains('.mat-mdc-option','Changement d’eau').click();
    cy.get('input[formControlName="title"]').should('have.value','Changement d’eau');
    cy.screenshot('task-dialog-mobile',{capture:'viewport'});
    cy.get('mat-dialog-container').contains('button','Annuler').click();
    cy.intercept('GET','**/api/aquariums*',[]);
    cy.contains('button','Nouvelle tâche').click();
    cy.get('mat-dialog-container').contains('button','Créer un aquarium').click();
    cy.location('pathname').should('eq','/aquariums');
  });
});
