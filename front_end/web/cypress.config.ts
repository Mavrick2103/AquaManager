import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:4200",
    specPattern: "cypress/e2e/**/*.cy.{js,ts}",
    supportFile: "cypress/support/e2e.{js,ts}",
    video: false,

    setupNodeEvents(on, config) {
      // Tu peux ajouter ici des listeners ou des plugins plus tard
    },
  },
});
