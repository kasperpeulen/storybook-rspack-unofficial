import { defineConfig } from 'tsup';

const shared = {
  format: ['esm'] as const,
  outDir: 'dist',
  external: [
    '@rollup/pluginutils',
    '@rspack/core',
    'storybook',
    'storybook/internal/types',
    'storybook/internal/common',
    'storybook/internal/node-logger',
    'storybook-builder-rspack-unofficial',
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
};

export default defineConfig([
  {
    ...shared,
    entry: ['src/index.ts', 'src/preset.ts', 'src/loaders/react-docgen-loader.ts', 'src/loaders/react-docgen-typescript-loader.ts'],
    dts: true,
    clean: true,
  },
  {
    ...shared,
    entry: { 'plugins/react-docgen-typescript-worker': 'src/plugins/react-docgen-typescript-worker.ts' },
    dts: false,
    clean: false,
  },
]);
