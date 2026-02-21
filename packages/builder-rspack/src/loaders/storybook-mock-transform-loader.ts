import { rewriteSbMockImportCalls } from 'storybook/internal/mocking-utils';
import { logger } from 'storybook/internal/node-logger';

import type { LoaderDefinition } from '@rspack/core';

/**
 * An Rspack loader that normalizes sb.mock(import(...)) calls to sb.mock(...)
 */
const storybookMockTransformLoader: LoaderDefinition = function mockTransformLoaderFn(
  source,
  sourceMap,
  meta
) {
  const callback = this.async();

  try {
    const result = rewriteSbMockImportCalls(source);
    callback(null, result.code, result.map || undefined, meta);
  } catch (error) {
    const filePath = this.resourcePath;
    logger.debug(`Could not transform sb.mock(import(...)) calls in ${filePath}: ${error}`);
    callback(null, source, sourceMap, meta);
  }
};

export default storybookMockTransformLoader;
