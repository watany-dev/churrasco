import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: ['src/extension.ts', 'src/test/**/*.test.ts', 'src/**/*.test.ts'],
  project: ['src/**/*.ts'],
  ignore: ['out/**', 'dist/**'],
  ignoreDependencies: [
    '@types/vscode',
    '@types/mocha',
    'mocha',
    '@vscode/test-electron',
    '@commitlint/cli',
  ],
  ignoreBinaries: ['xvfb-run'],
  vitest: {
    config: ['vitest.config.ts'],
    entry: ['src/**/*.test.ts'],
  },
};

export default config;
