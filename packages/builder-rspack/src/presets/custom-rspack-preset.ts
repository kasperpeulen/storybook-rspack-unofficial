import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { findConfigFile, serverRequire } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { Options, PresetProperty } from 'storybook/internal/types';

import { loadCustomWebpackConfig } from '@storybook/core-webpack';

import { rspack as rspackModule } from '@rspack/core';
import type { Configuration } from '@rspack/core';

import { RspackInjectMockerRuntimePlugin } from '../plugins/rspack-inject-mocker-runtime-plugin';
import { RspackMockPlugin } from '../plugins/rspack-mock-plugin';
import { createDefaultRspackConfig } from '../preview/base-rspack.config';

export const swc: PresetProperty<'swc'> = (config: Record<string, any>): Record<string, any> => {
  return {
    ...config,
    env: {
      ...(config?.env ?? {}),
      targets: config?.env?.targets ?? {
        chrome: 100,
        safari: 15,
        firefox: 91,
      },
      bugfixes: config?.env?.bugfixes ?? true,
    },
  };
};

export async function rspackFinal(config: Configuration, options: Options) {
  const previewConfigPath = findConfigFile('preview', options.configDir);

  // If there's no preview file, there's nothing to mock.
  if (!previewConfigPath) {
    return config;
  }

  config.plugins = config.plugins || [];

  // 1. Add the loader to normalize sb.mock(import(...)) calls.
  config.module!.rules!.push({
    test: /preview\.(t|j)sx?$/,
    use: [
      {
        loader: fileURLToPath(
          import.meta.resolve(
            'storybook-builder-rspack/loaders/storybook-mock-transform-loader'
          )
        ),
      },
    ],
  });

  // 2. Add the plugin to handle module replacement based on sb.mock() calls.
  config.plugins.push(new RspackMockPlugin({ previewConfigPath }));

  // 3. Add the plugin to inject the mocker runtime script into the HTML.
  config.plugins.push(new RspackInjectMockerRuntimePlugin());
  return config;
}

const rspackConfigs = ['rspack.config', 'webpack.config', 'webpackfile'];

async function loadCustomRspackConfig(configDir: string) {
  return serverRequire(rspackConfigs.map((configName) => resolve(configDir, configName)));
}

export async function rspack(config: Configuration, options: Options) {
  const { configDir, configType, presets } = options;

  const coreOptions = await presets.apply('core');

  let defaultConfig = config;
  if (!(coreOptions as any)?.disableWebpackDefaults) {
    defaultConfig = await createDefaultRspackConfig(config, options);
  }

  const finalDefaultConfig = await presets.apply('rspackFinal', defaultConfig, options);

  // Check whether user has a custom rspack/webpack config file and
  // return the (extended) base configuration if it's not available.
  const customConfig = await loadCustomRspackConfig(configDir);

  if (typeof customConfig === 'function') {
    logger.info('Loading custom Rspack config (full-control mode).');
    return customConfig({ config: finalDefaultConfig, mode: configType });
  }

  // Fallback: try loading webpack config for backward compat
  const customWebpackConfig = await loadCustomWebpackConfig(configDir);

  if (typeof customWebpackConfig === 'function') {
    logger.info('Loading custom Webpack config (full-control mode) for rspack.');
    return customWebpackConfig({ config: finalDefaultConfig, mode: configType });
  }

  logger.info('Using default Rspack setup');
  return finalDefaultConfig;
}

export const rspackInstance = async () => rspackModule;
