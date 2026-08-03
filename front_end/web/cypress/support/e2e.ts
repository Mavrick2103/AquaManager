// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Les scénarios E2E testent directement les pages métier. Le tutoriel de
// première connexion possède ses propres interactions et redirigerait sinon
// chaque session simulée vers le dashboard avant le chargement de la page.
Cypress.on('window:before:load', (win) => {
  win.localStorage.setItem('aquamanager-site-tour-v2:1', '1');
});
