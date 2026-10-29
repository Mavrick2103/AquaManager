/// <reference types="cypress" />
describe('Actions explicites sur une série',()=>{
  const occurrence={id:'r:41:2026-10-29T09:00:00.000Z',parentId:41,seriesDueAt:'2026-10-01T09:00:00.000Z',virtual:true,title:'Routine',description:'Ancienne note',type:'OTHER',status:'PENDING',dueAt:'2026-10-29T09:00:00.000Z',aquarium:{id:1,name:'Bac'},repeat:{mode:'WEEKLY',days:['THU'],durationWeeks:12}};
  beforeEach(()=>{
    cy.intercept('**/api/**',{statusCode:404,body:{}});
    cy.intercept('POST','**/api/auth/refresh',{access_token:'TEST_TOKEN'});
    cy.intercept('GET','**/api/users/me',{id:1,role:'USER',subscriptionPlan:'CLASSIC'});
    cy.intercept('POST','**/api/satisfaction/visit',{prompt:false});
    cy.intercept('GET','**/api/tasks*',[occurrence]);
    cy.intercept('GET','**/api/aquariums',[{id:1,name:'Bac'}]);
    cy.clock(Date.parse('2026-10-29T12:00:00Z'),['Date']);
    cy.viewport(390,844);
  });
  function open(){cy.visit('/calendar');cy.contains('button','Liste').click();cy.contains('.agenda-task','Routine').click();cy.contains('mat-list-item','Routine').click();}
  it('modifie la série à sa date d’origine et envoie explicitement une note vide',()=>{
    cy.intercept('PATCH','**/api/tasks/41',req=>req.reply({...occurrence,id:'41',...req.body})).as('update');
    open();cy.contains('Les modifications s’appliquent à toute la série').should('be.visible');
    cy.get('input[name="title"]').clear().type('Routine renommée');
    cy.get('textarea[name="desc"]').clear();
    cy.get('mat-dialog-container').last().contains('button','Enregistrer').click();
    cy.wait('@update').then(({request})=>{
      expect(request.body.dueAt).to.eq(occurrence.seriesDueAt);
      expect(request.body.repeat.durationWeeks).to.eq(12);
      expect(request.body.description).to.eq('');
    });
  });
  it('annonce la suppression globale et respecte l’annulation',()=>{
    const confirm=cy.stub().onFirstCall().returns(false).onSecondCall().returns(true);cy.on('window:confirm',confirm);
    cy.intercept('DELETE','**/api/tasks/41',{ok:true}).as('remove');
    open();cy.get('mat-dialog-container').last().contains('button','Supprimer toute la série').click();
    cy.get('@remove.all').should('have.length',0);
    cy.get('mat-dialog-container').last().contains('button','Supprimer toute la série').click();
    cy.wait('@remove');cy.wrap(confirm).should('have.been.calledWithMatch','Supprimer toute la série');
  });
  it('bloque les modifications si les informations de série ne sont pas encore disponibles',()=>{
    const {seriesDueAt,...legacy}=occurrence;
    cy.intercept('GET','**/api/tasks*',[legacy]);open();
    cy.get('mat-dialog-container [role="alert"]').should('contain.text','incomplètes');
    cy.get('mat-dialog-container').last().contains('button','Enregistrer').should('be.disabled');
    cy.get('mat-dialog-container').last().contains('button','Supprimer toute la série').should('be.disabled');
  });
});
