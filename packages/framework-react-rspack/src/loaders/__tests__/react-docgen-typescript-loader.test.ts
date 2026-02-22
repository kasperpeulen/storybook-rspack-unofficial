import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const fixturesPath = resolve(import.meta.dirname, '__fixtures__');
const tsconfigPath = resolve(import.meta.dirname, 'tsconfig.json');

const fixtureTests = readdirSync(fixturesPath)
  .map((filename) => join(fixturesPath, filename))
  .map((filename) => ({
    id: filename,
    code: readFileSync(filename, 'utf-8'),
  }));

function createMockLoaderContext(fixture: { id: string; code: string }) {
  let callbackResult: { err: any; code?: string; map?: any } | undefined;

  const context = {
    resourcePath: fixture.id,
    async() {
      return (err: any, code?: string, map?: any) => {
        callbackResult = { err, code, map };
      };
    },
    getOptions() {
      return {};
    },
  };

  return {
    context,
    getResult: () => callbackResult,
  };
}

const isUnix = process.platform !== 'win32';

describe.runIf(isUnix)('react-docgen-typescript-loader', () => {
  for (const fixture of fixtureTests) {
    it(`${basename(fixture.id)} has docgen code generated`, async () => {
      // Reset modules to clear the module-level tsconfig cache
      vi.resetModules();

      // Set the tsconfig path env so our loader finds the test tsconfig
      const loaderModule = await import('../react-docgen-typescript-loader');
      const loader = loaderModule.default;

      const { context, getResult } = createMockLoaderContext(fixture);

      // Call the loader with the mock context
      loader.call(context as any, fixture.code, undefined);

      const result = getResult();
      expect(result).toBeDefined();
      expect(result!.err).toBeNull();

      // Extract just the appended docgen code (after the original source)
      const appendedCode = result!.code!.slice(fixture.code.length);
      expect(appendedCode).toMatchSnapshot();
    });
  }
});
