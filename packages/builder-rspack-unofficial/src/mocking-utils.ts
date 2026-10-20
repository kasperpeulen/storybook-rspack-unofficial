import * as mockingUtils from 'storybook/internal/mocking-utils';
import type { MockCall } from 'storybook/internal/mocking-utils';

import type { LoaderDefinition } from '@rspack/core';

// Storybook 10's mocking-utils parse with Babel, and `getAutomockCode` and `extractMockCalls` take
// the parser, which they export as `babelParser`. Storybook 11's parse with oxc themselves and take
// the module's file name instead (storybookjs/storybook#36613). The calls below pass what the
// installed one takes. The Storybook 10 branches can go when the builder drops Storybook 10.

type ExtractMockCallsOptions = Parameters<typeof mockingUtils.extractMockCalls>[0];
type FindMockRedirect = typeof mockingUtils.findMockRedirect;
type LoaderSourceMap = Parameters<LoaderDefinition>[1];
type RawSourceMap = Exclude<LoaderSourceMap, string | undefined>;

interface Storybook10MockingUtils {
  babelParser: unknown;
  getAutomockCode(code: string, isSpy: boolean, parse: unknown): { toString(): string };
  extractMockCalls(
    options: ExtractMockCallsOptions,
    parse: unknown,
    root: string,
    findMockRedirect: FindMockRedirect
  ): MockCall[];
  rewriteSbMockImportCalls(code: string): { code: string; map: LoaderSourceMap | null };
}

interface Storybook11MockingUtils {
  getAutomockCode(code: string, isSpy: boolean, fileName: string): { toString(): string };
  extractMockCalls(
    options: ExtractMockCallsOptions,
    root: string,
    findMockRedirect: FindMockRedirect
  ): MockCall[];
  // The map can leave out `file`, which rspack's map type requires.
  rewriteSbMockImportCalls(
    code: string,
    fileName: string
  ): { code: string; map: (Omit<RawSourceMap, 'file'> & { file?: string }) | null };
}

const utils: Storybook10MockingUtils | Storybook11MockingUtils = mockingUtils;

export function getAutomockCode(code: string, isSpy: boolean, fileName: string) {
  return 'babelParser' in utils
    ? utils.getAutomockCode(code, isSpy, utils.babelParser)
    : utils.getAutomockCode(code, isSpy, fileName);
}

export function extractMockCalls(
  options: ExtractMockCallsOptions,
  root: string,
  findMockRedirect: FindMockRedirect
) {
  return 'babelParser' in utils
    ? utils.extractMockCalls(options, utils.babelParser, root, findMockRedirect)
    : utils.extractMockCalls(options, root, findMockRedirect);
}

/**
 * Rewrites `sb.mock(import('…'))` to `sb.mock('…')`, with the source map to hand on. Storybook 10
 * reprints the module and gives no map. Storybook 11 edits it in place and gives a map from the
 * loader's input, or `null` when it changed nothing, so the incoming map still holds. The map does
 * not chain onto an incoming one, which holds as long as this loader runs first.
 */
export function rewriteSbMockImportCalls(
  code: string,
  fileName: string,
  sourceMap: LoaderSourceMap
): { code: string; map: LoaderSourceMap } {
  if ('babelParser' in utils) {
    const result = utils.rewriteSbMockImportCalls(code);
    return { code: result.code, map: result.map || undefined };
  }
  const result = utils.rewriteSbMockImportCalls(code, fileName);
  return {
    code: result.code,
    map: result.map ? { ...result.map, file: fileName } : sourceMap,
  };
}
