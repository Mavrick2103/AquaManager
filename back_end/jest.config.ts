import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // on détecte tous les types de tests par le nommage
  testMatch: [
    '**/*.spec.ts',        // unitaires
    '**/*.functional.spec.ts',    // intégration
    '**/*.e2e-spec.ts',    // E2E
  ],
  // utile pour SQLite in-memory en intégration : exécuter en séquentiel
  maxWorkers: 1,
};

export default config;
