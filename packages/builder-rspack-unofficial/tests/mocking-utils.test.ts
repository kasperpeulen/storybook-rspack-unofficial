import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as installedMockingUtils from 'storybook/internal/mocking-utils';
import { findMockRedirect } from 'storybook/internal/mocking-utils';
import { afterAll, describe, expect, it } from 'vitest';

import {
  extractMockCalls,
  getAutomockCode,
  rewriteSbMockImportCalls,
} from '../src/mocking-utils';

// `extractMockCalls` reports its use; keep the tests out of Storybook's telemetry.
process.env.STORYBOOK_DISABLE_TELEMETRY = '1';

// Storybook 10's mocking-utils export `babelParser`, and Storybook 11's since
// storybookjs/storybook#36613 do not. Each suite runs on the one it is written for.
const takesBabelParser = 'babelParser' in installedMockingUtils;
const storybook10 = 'Storybook 10 mocking-utils, which export babelParser';
const storybook11 = 'Storybook 11 mocking-utils, which parse with oxc';
const skipped = ' (skipped: the installed mocking-utils are the others)';

const dir = realpathSync(mkdtempSync(join(tmpdir(), 'rspack-mocking-utils-')));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
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
    const options = { previewConfigPath: preview, configDir: dir };
    const calls = extractMockCalls(options, dir, findMockRedirect);
    expect(calls).toEqual([
      { path: './greeting', absolutePath: greeting, redirectPath: null, spy: true },
    ]);
  });

  it('rewrites sb.mock(import(...)) to sb.mock(...)', () => {
    const { code } = rewriteSbMockImportCalls(previewCode, preview, incomingMap);
    expect(code).toMatch(/^sb\.mock\("\.\/greeting\.ts", \{\s+spy: true\s+\}\);/);
  });
};

describe.runIf(takesBabelParser)(storybook10 + (takesBabelParser ? '' : skipped), () => {
  sharedTests();

  it('hands on no source map, as Babel reprints the module', () => {
    expect(rewriteSbMockImportCalls(previewCode, preview, incomingMap).map).toBeUndefined();
    expect(rewriteSbMockImportCalls('let a = 1;\n', preview, incomingMap).map).toBeUndefined();
  });
});

describe.runIf(!takesBabelParser)(storybook11 + (takesBabelParser ? skipped : ''), () => {
  sharedTests();

  it("hands on the rewrite's source map, for the module", () => {
    const { map } = rewriteSbMockImportCalls(previewCode, preview, incomingMap);
    expect(map).toMatchObject({ file: preview, sources: [preview] });
  });

  it('hands on the incoming source map when nothing is rewritten', () => {
    const code = 'let a = 1;\n';
    const result = rewriteSbMockImportCalls(code, preview, incomingMap);
    expect(result.code).toBe(code);
    expect(result.map).toBe(incomingMap);
  });
});
