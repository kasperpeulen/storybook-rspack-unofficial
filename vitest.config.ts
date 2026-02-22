import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';

// Polyfill import.meta.resolve for vitest's SSR transform.
// Vitest replaces import.meta.resolve with __vite_ssr_import_meta__.resolve which doesn't exist.
// This plugin runs before that transform and replaces it with a Node.js createRequire polyfill.
const importMetaResolvePlugin = () => ({
  name: 'import-meta-resolve-polyfill',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (id.includes('node_modules')) return;
    if (!code.includes('import.meta.resolve')) return;

    return {
      code: code.replace(
        /import\.meta\.resolve\(([^)]+)\)/g,
        '((specifier) => { const { createRequire: cr } = require("node:module"); return "file://" + cr(import.meta.url).resolve(specifier); })($1)',
      ),
      map: null,
    };
  },
});

export default defineConfig({
  plugins: [importMetaResolvePlugin()],
  test: {
    environment: 'node',
    setupFiles: ['./vitest-setup.ts'],
    include: ['packages/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', 'storybook-source/**', 'storybook-rsbuild-source/**'],
  },
});
