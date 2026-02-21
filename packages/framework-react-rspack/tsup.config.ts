import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/preset.ts'],
  format: ['esm'],
  dts: true,
  outDir: 'dist',
  clean: true,
  external: [
    '@rspack/core',
    'storybook',
    'storybook/internal/types',
    'storybook-builder-rspack',
    'react',
    'react-dom',
  ],
  splitting: false,
});
