import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ReactDocgenTypescriptPlugin } from '../../plugins/react-docgen-typescript';

const fixturesPath = resolve(import.meta.dirname, '__fixtures__');

const fixtureTests = readdirSync(fixturesPath)
  .map((filename) => join(fixturesPath, filename))
  .map((filename) => ({
    id: filename,
    code: readFileSync(filename, 'utf-8'),
  }));

const HANDLER_KEY = '__reactDocgenHandler';

let shutdownFn: (() => Promise<void>) | undefined;

function createMockCompiler() {
  const compiler: any = {
    hooks: {
      shutdown: {
        tapPromise: (_name: string, fn: () => Promise<void>) => {
          shutdownFn = fn;
        },
      },
    },
    context: fixturesPath,
  };
  return compiler;
}

const isUnix = process.platform !== 'win32';

describe.runIf(isUnix)('react-docgen-typescript-loader', () => {
  const compiler = createMockCompiler();
  const plugin = new ReactDocgenTypescriptPlugin({
    include: ['**/*.tsx'],
  });
  plugin.apply(compiler);

  const handler = compiler[HANDLER_KEY] as (
    resourcePath: string,
    source: string,
  ) => Promise<{ code: string; map: any } | null>;

  afterAll(async () => {
    if (shutdownFn) await shutdownFn();
  });

  for (const fixture of fixtureTests) {
    it(`${basename(fixture.id)} has docgen code generated`, async () => {
      const result = await handler(fixture.id, fixture.code);

      if (result) {
        const appendedCode = result.code.slice(fixture.code.length);
        expect(appendedCode).toMatchSnapshot();
      } else {
        expect(result).toMatchSnapshot();
      }
    });
  }
});
