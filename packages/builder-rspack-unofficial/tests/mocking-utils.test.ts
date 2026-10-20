import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as installedMockingUtils from 'storybook/internal/mocking-utils';
import { findMockRedirect } from 'storybook/internal/mocking-utils';
import { describe, expect, it } from 'vitest';

import {
  extractMockCalls,
  getAutomockCode,
  rewriteSbMockImportCalls,
} from '../src/mocking-utils';

// Storybook 10's mocking-utils export `babelParser`; Storybook 11's do not.
const installed = 'babelParser' in installedMockingUtils ? 10 : 11;
const suiteName = (version: number) =>
  installed === version
    ? `mocking-utils on Storybook ${version}`
    : `mocking-utils on Storybook ${version} (skipped: Storybook ${installed} is installed)`;

const dir = realpathSync(mkdtempSync(join(tmpdir(), 'rspack-mocking-utils-')));
const greeting = join(dir, 'greeting.ts');
const preview = join(dir, 'preview.ts');
writeFileSync(greeting, "export function greet(name: string) { return 'hi ' + name; }\n");
writeFileSync(
  preview,
  "import { sb } from 'storybook/test';\nsb.mock(import('./greeting.ts'), { spy: true });\n"
);
const previewCode = "sb.mock(import('./greeting.ts'), { spy: true });\n";
const incomingMap = { version: 3, sources: [preview], names: [], mappings: 'AAAA' };

// What both Storybooks do the same.
const sharedTests = () => {
  it('automocks a module', () => {
    const code = 'export function greet(name) { return "hi " + name; }\n';
    const mocked = getAutomockCode(code, false, join(dir, 'greeting.js')).toString();
    expect(mocked).toContain('__vitest_mocker__');
    expect(mocked).toContain('"automock"');
  });

  it('extracts the mock calls of the preview file', () => {
    const calls = extractMockCalls({ previewConfigPath: preview, configDir: dir }, dir, findMockRedirect);
    expect(calls).toEqual([
      { path: './greeting', absolutePath: greeting, redirectPath: null, spy: true },
    ]);
  });

  it('rewrites sb.mock(import(...)) to sb.mock(...)', () => {
    const { code } = rewriteSbMockImportCalls(previewCode, preview, incomingMap);
    expect(code).toMatch(/^sb\.mock\("\.\/greeting\.ts", \{\s+spy: true\s+\}\);/);
  });
};

describe.runIf(installed === 10)(suiteName(10), () => {
  sharedTests();

  it('hands on no source map, as Babel reprints the module', () => {
    expect(rewriteSbMockImportCalls(previewCode, preview, incomingMap).map).toBeUndefined();
    expect(rewriteSbMockImportCalls('let a = 1;\n', preview, incomingMap).map).toBeUndefined();
  });
});

describe.runIf(installed === 11)(suiteName(11), () => {
  sharedTests();

  it("hands on the rewrite's source map, for the module", () => {
    const { map } = rewriteSbMockImportCalls(previewCode, preview, incomingMap);
    expect(map).toMatchObject({ file: preview, sources: [preview] });
  });

  it('hands on the incoming source map when nothing is rewritten', () => {
    const code = 'let a = 1;\n';
    expect(rewriteSbMockImportCalls(code, preview, incomingMap)).toEqual({
      code,
      map: incomingMap,
    });
  });
});
