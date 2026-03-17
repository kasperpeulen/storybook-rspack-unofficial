import type {
  BuilderResult as BuilderResultBase,
  Options,
  StorybookConfig,
  TypescriptOptions as BaseTypescriptOptions,
} from '@storybook/core-webpack';

import type { Configuration, Stats } from '@rspack/core';

type TypeScriptOptionsBase = Partial<BaseTypescriptOptions>;

/** Options for TypeScript usage within Storybook. */
export interface TypescriptOptions extends TypeScriptOptionsBase {}

export interface StorybookConfigRspack
  extends Omit<StorybookConfig, 'webpack' | 'webpackFinal' | 'features'> {
  /**
   * Modify or return a custom Rspack config after the Storybook's default configuration has run
   * (mostly used by addons).
   */
  rspack?: (config: Configuration, options: Options) => Configuration | Promise<Configuration>;

  /** Modify or return a custom Rspack config after every addon has run. */
  rspackFinal?: (
    config: Configuration,
    options: Options
  ) => Configuration | Promise<Configuration>;

  features?: StorybookConfig['features'] & {
    experimentalTestSyntax?: boolean;
  };
}

export type BuilderOptions = {
  fsCache?: boolean;
  lazyCompilation?: boolean;
};

export interface BuilderResult extends BuilderResultBase {
  stats?: Stats;
}
