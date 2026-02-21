import { fileURLToPath } from 'node:url';
import { resolve, isAbsolute } from 'node:path';

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
  const rawPreviewConfigPath = findConfigFile('preview', options.configDir);

  // If there's no preview file, there's nothing to mock.
  if (!rawPreviewConfigPath) {
    return config;
  }

  const previewConfigPath = isAbsolute(rawPreviewConfigPath)
    ? rawPreviewConfigPath
    : resolve(process.cwd(), rawPreviewConfigPath);

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

  // Pick up webpack preset contributions from addons (e.g. addon-docs adds MDX loader via `webpack` hook).
  // Many Storybook addons only export `webpack`, not `rspack`, so we merge those rules/plugins.
  try {
    const webpackContributions = await presets.apply('webpack', {}, options) as Configuration;
    if (webpackContributions?.module?.rules) {
      defaultConfig.module = defaultConfig.module || {};
      defaultConfig.module.rules = [
        ...(defaultConfig.module.rules || []),
        ...webpackContributions.module.rules,
      ];
    }
    if (webpackContributions?.plugins) {
      defaultConfig.plugins = [
        ...(defaultConfig.plugins || []),
        ...webpackContributions.plugins,
      ];
    }
    if (webpackContributions?.resolve) {
      defaultConfig.resolve = {
        ...defaultConfig.resolve,
        ...webpackContributions.resolve,
        alias: {
          ...(defaultConfig.resolve?.alias as Record<string, string> || {}),
          ...(webpackContributions.resolve?.alias as Record<string, string> || {}),
        },
      };
    }
  } catch {
    // No webpack contributions from addons — that's fine
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
