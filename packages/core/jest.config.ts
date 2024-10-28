import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.spec.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: { '@neonevm/solana-sign': '<rootDir>/dist' },
  testEnvironmentOptions: { path: '.env' }
};
export default config;

