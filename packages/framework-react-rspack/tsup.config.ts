import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/preset.ts', 'src/loaders/react-docgen-loader.ts', 'src/loaders/react-docgen-typescript-loader.ts'],
  format: ['esm'],
  dts: true,
  outDir: 'dist',
  clean: true,
  external: [
    '@rollup/pluginutils',
    '@rspack/core',
    'storybook',
    'storybook/internal/types',
    'storybook/internal/common',
    'storybook/internal/node-logger',
    'storybook-builder-rspack',
    'react',
    'react-dom',
    'typescript',
    'react-docgen',
    'react-docgen-typescript',
    'magic-string',
    'empathic',
    'tsconfig-paths',
    'resolve',
  ],
  splitting: false,
});
