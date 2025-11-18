import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  testMatch: [
    '**/*.spec.ts',
    '**/*.functional.spec.ts',
    '**/*.e2e-spec.ts',
  ],
  maxWorkers: 1,
};

export default config;
