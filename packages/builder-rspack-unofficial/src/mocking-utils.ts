import * as mockingUtils from 'storybook/internal/mocking-utils';
import type { MockCall } from 'storybook/internal/mocking-utils';

import type { LoaderDefinition } from '@rspack/core';

// Storybook 10's mocking-utils parse with a Babel parser that the caller passes in, and that they
// export as `babelParser`. Storybook 11's parse with oxc themselves and take the module's file name
// instead (storybookjs/storybook#36613). The calls below pass what the installed one takes.

type ExtractMockCallsOptions = Parameters<typeof mockingUtils.extractMockCalls>[0];
type FindMockRedirect = typeof mockingUtils.findMockRedirect;
type LoaderSourceMap = Parameters<LoaderDefinition>[1];

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
  rewriteSbMockImportCalls(
    code: string,
    fileName: string
  ): { code: string; map: Exclude<LoaderSourceMap, string | undefined> | null };
}

const utils = mockingUtils as unknown as Storybook10MockingUtils | Storybook11MockingUtils;


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
 * reprints the module and gives no map. Storybook 11 edits it in place and gives a map, or `null`
 * when it changed nothing, so the incoming map still holds.
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
