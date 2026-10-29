/// <reference types="cypress" />
describe('Retrait d’un accès offert',()=>{
  it('affiche le refus puis confirme le retrait après un nouvel essai',()=>{
    cy.viewport(1280,900);
    cy.intercept('**/api/**',{statusCode:404,body:{}});
    cy.intercept('POST','**/api/auth/refresh',{access_token:'TEST_TOKEN'});
    cy.intercept('GET','**/api/users/me',{id:1,role:'ADMIN'});
    cy.intercept('POST','**/api/satisfaction/visit',{prompt:false});
    cy.intercept('GET','**/api/admin/users*',[{id:2,fullName:'Camille',email:'camille@example.test',role:'USER',subscriptionPlan:'PREMIUM',subscriptionStatus:'active',subscriptionEndsAt:null}]);
    cy.intercept('PATCH','**/api/admin/users/2/revoke-subscription',{statusCode:409,body:{message:'Résilie d’abord l’abonnement PayPal pour retirer les droits.'}}).as('revoke');
    cy.on('window:confirm',()=>true);cy.visit('/admin/users');
    function remove(){cy.contains('button','PREMIUM').click();cy.contains('button','Retirer l’accès premium').click();}
    remove();cy.wait('@revoke');
    cy.get('[role="alert"]').should('contain.text','Résilie d’abord');
    cy.intercept('PATCH','**/api/admin/users/2/revoke-subscription',{id:2,role:'USER',subscriptionPlan:'CLASSIC',subscriptionStatus:'none',subscriptionEndsAt:null}).as('retry');
    remove();cy.wait('@retry');
    cy.get('[role="status"]').should('contain.text','revenu à Classic');
    cy.contains('button','CLASSIC').should('exist');
    cy.get('[role="alert"]').should('not.exist');
  });
});
