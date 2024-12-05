import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.spec.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '@neonevm/solana-sign': '<rootDir>/src',
    '@neonevm/solana-contracts': '<rootDir>/../contracts/src',
    '@neonevm/solana-contracts/build': '<rootDir>/../contracts/build',
  },
  testEnvironmentOptions: { path: '.env' },
  testTimeout: 2e5,
  detectOpenHandles: false,
  forceExit: false
};
export default config;

