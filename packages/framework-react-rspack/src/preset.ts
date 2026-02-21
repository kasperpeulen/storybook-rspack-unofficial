import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';
import type { Configuration } from '@rspack/core';

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: 'storybook-builder-rspack',
      options: (typeof framework === 'object' ? framework?.options?.builder : {}) || {},
    },
    renderer: '@storybook/react',
  };
};

export const rspackFinal = async (config: Configuration, options: any): Promise<Configuration> => {
  const typescriptOptions = await options.presets.apply('typescript', {} as any);
  const debug = options.loglevel === 'debug';

  const { reactDocgen = 'react-docgen', reactDocgenTypescriptOptions } = typescriptOptions || {};

  if (!reactDocgen || typeof reactDocgen !== 'string') {
    return config;
  }

  if (reactDocgen === 'react-docgen-typescript') {
    return {
      ...config,
      module: {
        ...(config.module ?? {}),
        rules: [
          ...(config.module?.rules ?? []),
          // react-docgen loader for JS/JSX files
          {
            test: /\.(cjs|mjs|jsx?)$/,
            enforce: 'pre' as const,
            loader: fileURLToPath(
              import.meta.resolve('storybook-react-rspack/loaders/react-docgen-loader')
            ),
            options: { debug },
            exclude: /(\.(stories|story)\.(js|jsx|ts|tsx))|(node_modules)/,
          },
          // react-docgen-typescript loader for TS/TSX files
          {
            test: /\.tsx?$/,
            enforce: 'pre' as const,
            loader: fileURLToPath(
              import.meta.resolve('storybook-react-rspack/loaders/react-docgen-typescript-loader')
            ),
            options: {
              savePropValueAsString: true,
              ...reactDocgenTypescriptOptions,
            },
            exclude: /(\.(stories|story)\.(ts|tsx))|(node_modules)/,
          },
        ],
      },
    };
  }

  // Default: react-docgen mode
  return {
    ...config,
    module: {
      ...(config.module ?? {}),
      rules: [
        ...(config.module?.rules ?? []),
        {
          test: /\.(cjs|mjs|tsx?|jsx?)$/,
          enforce: 'pre' as const,
          loader: fileURLToPath(
            import.meta.resolve('storybook-react-rspack/loaders/react-docgen-loader')
          ),
          options: { debug },
          exclude: /(\.(stories|story)\.(js|jsx|ts|tsx))|(node_modules)/,
        },
      ],
    },
  };
};
