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

  const { reactDocgen = 'react-docgen' } = typescriptOptions || {};

  if (!reactDocgen || typeof reactDocgen !== 'string') {
    return config;
  }

  // Only support react-docgen mode (not react-docgen-typescript) for now
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
          options: {
            debug,
          },
          exclude: /(\.(stories|story)\.(js|jsx|ts|tsx))|(node_modules)/,
        },
      ],
    },
  };
};
