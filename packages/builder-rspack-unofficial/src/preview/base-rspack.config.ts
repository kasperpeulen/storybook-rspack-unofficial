import { fileURLToPath } from 'node:url';

import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import type { Configuration } from '@rspack/core';

export async function createDefaultRspackConfig(
  storybookBaseConfig: Configuration,
  options: Options
): Promise<Configuration> {
  if (
    options.presetsList?.some((preset) =>
      /@storybook(\/|\\)preset-create-react-app/.test(
        typeof preset === 'string' ? preset : preset.name
      )
    )
  ) {
    return storybookBaseConfig;
  }

  const hasPostcssAddon = options.presetsList?.some((preset) =>
    /@storybook(\/|\\)addon-postcss/.test(typeof preset === 'string' ? preset : preset.name)
  );

  let cssLoaders = {};
  if (!hasPostcssAddon) {
    logger.info(`Using implicit CSS loaders`);
    cssLoaders = {
      test: /\.css$/,
      sideEffects: true,
      use: [
        fileURLToPath(import.meta.resolve('style-loader')),
        {
          loader: fileURLToPath(import.meta.resolve('css-loader')),
          options: {
            importLoaders: 1,
          },
        },
      ],
    };
  }

  const isProd = storybookBaseConfig.mode !== 'development';

  return {
    ...storybookBaseConfig,
    module: {
      ...storybookBaseConfig.module,
      rules: [
        ...(storybookBaseConfig.module?.rules || []),
        cssLoaders,
        {
          test: /\.(svg|ico|jpg|jpeg|png|apng|gif|eot|otf|webp|ttf|woff|woff2|cur|ani|pdf)(\?.*)?$/,
          type: 'asset/resource',
          generator: {
            filename: isProd
              ? 'static/media/[name].[contenthash:8][ext]'
              : 'static/media/[path][name][ext]',
          },
        },
        {
          test: /\.(mp4|webm|wav|mp3|m4a|aac|oga)(\?.*)?$/,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 10000,
            },
          },
          generator: {
            filename: isProd
              ? 'static/media/[name].[contenthash:8][ext]'
              : 'static/media/[path][name][ext]',
          },
        },
        {
          resourceQuery: /raw/,
          type: 'asset/source',
        },
      ],
    },
    resolve: {
      ...storybookBaseConfig.resolve,
      conditionNames: [
        ...(storybookBaseConfig.resolve?.conditionNames ?? []),
        'storybook',
        'stories',
        'test',
        '...',
      ],
      fallback: {
        crypto: false,
        assert: false,
        ...storybookBaseConfig.resolve?.fallback,
      },
    },
  } as Configuration;
}
