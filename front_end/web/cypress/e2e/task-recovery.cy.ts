/// <reference types="cypress" />
describe('Tâches et mesures : conservation de la saisie', () => {
  const task={id:41,title:'Entretien régulier',description:'',type:'OTHER',status:'PENDING',dueAt:new Date(2026,9,29,9).toISOString(),aquarium:{id:1,name:'Bac'},repeat:{mode:'WEEKLY',days:['THU']}};
  beforeEach(()=>{
    cy.intercept('**/api/**',{statusCode:404,body:{}});
    cy.intercept('POST','**/api/auth/refresh',{access_token:'TEST_TOKEN'});
    cy.intercept('GET','**/api/users/me',{id:1,role:'USER',subscriptionPlan:'CLASSIC'});
    cy.intercept('POST','**/api/satisfaction/visit',{prompt:false});
    cy.intercept('GET','**/api/tasks*',[task]);
    cy.intercept('GET','**/api/aquariums',[{id:1,name:'Bac'}]);
    cy.clock(Date.parse('2026-10-29T12:00:00Z'),['Date']);
    cy.viewport(390,844);
  });
  it('conserve le formulaire après un échec et ferme après un seul enregistrement réussi',()=>{
    let requests=0;
    cy.intercept('POST','**/api/tasks',req=>{
      requests++;
      req.reply(requests===1 ? {statusCode:503,body:{message:'Indisponible'}} : {id:51,...req.body});
    }).as('create');
    cy.visit('/calendar');cy.contains('button','Nouvelle tâche').click();
    cy.get('input[formControlName="title"]').type('Une saisie à conserver');
    cy.get('mat-dialog-container').contains('button','Enregistrer').click();
    cy.wait('@create');
    cy.get('mat-dialog-container [role="alert"]').should('contain.text','saisie est conservée');
    cy.get('input[formControlName="title"]').should('have.value','Une saisie à conserver');
    cy.get('mat-dialog-container').contains('button','Enregistrer').click();
    cy.wait('@create');cy.get('mat-dialog-container').should('not.exist');
    cy.then(()=>expect(requests).to.eq(2));
  });
  for (const duration of [undefined,12]) {
    it(`préserve la durée ${duration ?? 'indéfinie'} lors d’un changement de titre`,()=>{
      cy.intercept('GET','**/api/tasks*',[{...task,repeat:{...task.repeat,durationWeeks:duration}}]);
      cy.intercept('PATCH','**/api/tasks/41',req=>req.reply({...task,...req.body})).as('update');
      cy.visit('/calendar');cy.contains('button','Liste').click();
      cy.contains('.agenda-task','Entretien régulier').click();
      cy.contains('mat-list-item','Entretien régulier').click();
      if(duration===undefined)cy.get('input[name="repeatDurationWeeks"]').should('not.exist');
      else cy.get('input[name="repeatDurationWeeks"]').should('have.value',String(duration));
      cy.get('input[name="title"]').clear().type('Entretien renommé');
      cy.get('mat-dialog-container').last().contains('button','Enregistrer').click();
      cy.wait('@update').then(({request})=>expect(request.body.repeat.durationWeeks).to.eq(duration));
    });
  }
  it('affiche l’échec de validation et permet de réessayer sans changer l’état avant confirmation',()=>{
    cy.intercept('PATCH','**/api/tasks/41',{statusCode:503,body:{message:'Indisponible'}}).as('update');
    cy.visit('/calendar');cy.contains('button','Liste').click();
    cy.get('.agenda-task__check').should('have.attr','aria-label','Terminer Entretien régulier').click();
    cy.wait('@update');
    cy.get('.agenda-task').should('not.have.class','agenda-task--done');
    cy.get('[role="alert"]').should('contain.text','état est inchangé');
    cy.intercept('PATCH','**/api/tasks/41',{...task,status:'DONE'}).as('retry');
    cy.intercept('GET','**/api/tasks*',[{...task,status:'DONE'}]);
    cy.get('.agenda-task__check').should('not.be.disabled').click();cy.wait('@retry');
    cy.get('.agenda-task').should('have.class','agenda-task--done');
    cy.get('[role="alert"]').should('not.exist');
    cy.get('.agenda-task__check').should('have.attr','aria-label','Remettre à faire Entretien régulier');
  });
  it('préserve les valeurs saisies et préremplit uniquement les champs intacts',()=>{
    cy.intercept('GET','**/api/aquariums/1',{id:1,name:'Bac',waterType:'EAU_DOUCE',lengthCm:60,widthCm:30,heightCm:35});
    cy.intercept('GET','**/api/aquariums/1/measurements*',[]);
    cy.visit('/aquariums/1');
    cy.intercept('GET','**/api/aquariums/1/measurements*',{delay:2500,body:[{id:2,ph:7,temp:24,no3:12,measuredAt:'2026-10-28T10:00:00Z'}]}).as('last');
    cy.contains('button',/ajouter une mesure/i).click();
    cy.get('input[formControlName="ph"]').type('8');
    cy.get('input[formControlName="no3"]').type('10').clear();
    cy.wait('@last');cy.contains('Valeurs reprises du relevé').should('exist');
    cy.get('input[formControlName="ph"]').should('have.value','8');
    cy.get('input[formControlName="no3"]').should('have.value','');
    cy.get('input[formControlName="temp"]').should('have.value','24');
    cy.get('mat-dialog-container').contains('button','Enregistrer').scrollIntoView().should('be.visible');
    cy.screenshot('mesure-saisie-preservee-mobile',{capture:'viewport'});
  });
});
