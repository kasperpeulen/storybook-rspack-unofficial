import { getAutomockCode } from 'storybook/internal/mocking-utils';

import type { LoaderContext } from '@rspack/core';

/** Defines the options that can be passed to the rspack-automock-loader. */
interface AutomockLoaderOptions {
  /**
   * If true, the module will be spied upon instead of fully mocked. This retains the original
   * implementation while tracking calls.
   */
  spy: string;
}

/**
 * An Rspack loader that transforms a module's source code into an automocked version. It uses
 * `@vitest/mocker`'s `automockModule` function to replace all exports with mock implementations or
 * spies.
 *
 * This loader is intended to be used by `RspackMockPlugin` when no `__mocks__` file is found for a
 * module specified in `sb.mock()`.
 */
export default function rspackAutomockLoader(
  this: LoaderContext<AutomockLoaderOptions>,
  source: string
) {
  const options = this.getOptions();
  const isSpy = options.spy === 'true';

  const mocked = getAutomockCode(source, isSpy, this.resourcePath);

  return mocked.toString();
}
