import type { Config } from 'jest';
import path from 'path';

const config: Config = {
  testEnvironment: 'node',
  rootDir: './src',
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: path.resolve(__dirname, 'tsconfig.test.json'),
      },
    ],
  },
  clearMocks: true,
  collectCoverageFrom: [
    '**/*.ts',
    '!**/tests/**',
    '!server.ts',
    '!app.ts',
    '!db/**',
  ],
  coverageDirectory: '../coverage',
};

export default config;
