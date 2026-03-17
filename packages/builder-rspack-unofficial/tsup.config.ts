import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/loaders/export-order-loader.ts',
    'src/loaders/storybook-mock-transform-loader.ts',
    'src/loaders/rspack-automock-loader.ts',
    'src/presets/preview-preset.ts',
    'src/presets/custom-rspack-preset.ts',
  ],
  format: ['esm'],
  dts: true,
  outDir: 'dist',
  clean: true,
  external: [
    '@rspack/core',
    'storybook',
    'storybook/internal/common',
    'storybook/internal/core-events',
    'storybook/internal/node-logger',
    'storybook/internal/types',
    'storybook/internal/mocking-utils',
    'storybook/internal/preview/globals',
    '@storybook/core-webpack',
    'webpack-dev-middleware',
    'webpack-hot-middleware',
  ],
  splitting: false,
});
