import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getBuilderOptions,
  isPreservingSymlinks,
  normalizeStories,
  stringifyProcessEnvs,
} from 'storybook/internal/common';
import { globalsNameReferenceMap } from 'storybook/internal/preview/globals';
import type { Options } from 'storybook/internal/types';

import { type BuilderOptions } from '@storybook/core-webpack';

import { rspack as rspackModule } from '@rspack/core';
import type { Configuration } from '@rspack/core';

import type { TypescriptOptions } from '../types.js';
import { getVirtualModules } from './virtual-module-mapping.js';

const { DefinePlugin, HotModuleReplacementPlugin, ProgressPlugin } = rspackModule;

export default async (
  options: Options & { typescriptOptions: TypescriptOptions }
): Promise<Configuration> => {
  const {
    outputDir = join('.', 'public'),
    quiet,
    packageJson,
    configType,
    presets,
    typescriptOptions,
    features,
  } = options;
  // Storybook 11 drops `--preview-url` and this option with it (storybookjs/storybook#36451).
  const { previewUrl } = options as { previewUrl?: string };

  const isProd = configType === 'PRODUCTION';
  const workingDir = process.cwd();

  const [
    coreOptions,
    frameworkOptions,
    envs,
    logLevel,
    headHtmlSnippet,
    bodyHtmlSnippet,
    docsOptions,
    entries,
    nonNormalizedStories,
    modulesCount,
    build,
    tagsOptions,
  ] = await Promise.all([
    presets.apply('core'),
    presets.apply('frameworkOptions'),
    presets.apply<Record<string, string>>('env'),
    presets.apply('logLevel', undefined),
    presets.apply('previewHead'),
    presets.apply('previewBody'),
    presets.apply('docs'),
    presets.apply<string[]>('entries', []),
    presets.apply('stories', []),
    options.cache?.get('modulesCount', 1000),
    options.presets.apply('build'),
    presets.apply('tags', {}),
  ]);

  const stories = normalizeStories(nonNormalizedStories, {
    configDir: options.configDir,
    workingDir,
  });

  const builderOptions = await getBuilderOptions<BuilderOptions>(options);

  const cacheConfig = builderOptions.fsCache ? { cache: { type: 'filesystem' as const } } : {};
  const lazyCompilationConfig =
    builderOptions.lazyCompilation && !isProd
      ? {
          lazyCompilation: { entries: false },
        }
      : {};

  const externals: Record<string, string> = globalsNameReferenceMap;
  if ((build as any)?.test?.disableBlocks) {
    externals['@storybook/addon-docs/blocks'] = '__STORYBOOK_BLOCKS_EMPTY_MODULE__';
  }

  const { virtualModules: virtualModuleMapping, entries: dynamicEntries } =
    await getVirtualModules(options);

  return {
    name: 'preview',
    mode: isProd ? 'production' : 'development',
    target: 'web',
    bail: isProd,
    devtool: (options as any).build?.test?.disableSourcemaps ? false : 'cheap-module-source-map',
    entry: [...(entries ?? []), ...dynamicEntries],
    output: {
      path: resolve(process.cwd(), outputDir),
      filename: isProd ? '[name].[contenthash:8].iframe.bundle.js' : '[name].iframe.bundle.js',
      publicPath: '',
      // Pin to a stable name so the HMR function (webpackHotUpdate<uniqueName>)
      // never changes between builds regardless of the project's package.json name.
      uniqueName: 'storybookPreview',
    },
    stats: {
      preset: 'none',
      logging: 'error',
    },
    watchOptions: {
      ignored: /node_modules/,
    },
    externals,
    ignoreWarnings: [
      {
        message: /export '\S+' was not found in 'global'/,
      },
      {
        message: /export '\S+' was not found in '@storybook\/global'/,
      },
      {
        message: /Critical dependency: require function is used in a way/,
      },
    ],
    plugins: [
      Object.keys(virtualModuleMapping).length > 0
        ? new rspackModule.experiments.VirtualModulesPlugin(virtualModuleMapping)
        : (null as any),
      new rspackModule.HtmlRspackPlugin({
        filename: 'iframe.html',
        chunksSortMode: 'manual' as const,
        inject: false,
        templateContent: ({ htmlRspackPlugin }: any) => {
          const { files } = htmlRspackPlugin;

          const globals: Record<string, any> = {
            CONFIG_TYPE: configType,
            LOGLEVEL: logLevel,
            FRAMEWORK_OPTIONS: frameworkOptions,
            CHANNEL_OPTIONS: (coreOptions as any).channelOptions,
            FEATURES: features,
            PREVIEW_URL: previewUrl,
            STORIES: stories.map((specifier: any) => ({
              ...specifier,
              importPathMatcher: specifier.importPathMatcher.source,
            })),
            DOCS_OPTIONS: docsOptions,
            TAGS_OPTIONS: tagsOptions,
            ...((build as any)?.test?.disableBlocks
              ? { __STORYBOOK_BLOCKS_EMPTY_MODULE__: {} }
              : {}),
          };

          const cssLinks = files.css
            .map((file: string) => `<link href="${file}" rel="stylesheet" />`)
            .join('\n    ');

          const jsImports = files.js
            .map((file: string) => `import './${file}';`)
            .join('\n      ');

          const globalsScript =
            Object.keys(globals).length > 0
              ? `<script>\n${Object.entries(globals)
                  .filter(([, v]) => v != null)
                  .map(([k, v]) => `      window['${k}'] = ${JSON.stringify(v)};`)
                  .join('\n')}\n    </script>`
              : '';

          return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Storybook</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @font-face {
        font-family: 'Nunito Sans';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url('./sb-common-assets/nunito-sans-regular.woff2') format('woff2');
      }
      @font-face {
        font-family: 'Nunito Sans';
        font-style: italic;
        font-weight: 400;
        font-display: swap;
        src: url('./sb-common-assets/nunito-sans-italic.woff2') format('woff2');
      }
      @font-face {
        font-family: 'Nunito Sans';
        font-style: normal;
        font-weight: 700;
        font-display: swap;
        src: url('./sb-common-assets/nunito-sans-bold.woff2') format('woff2');
      }
      @font-face {
        font-family: 'Nunito Sans';
        font-style: italic;
        font-weight: 700;
        font-display: swap;
        src: url('./sb-common-assets/nunito-sans-bold-italic.woff2') format('woff2');
      }
    </style>
    ${headHtmlSnippet || ''}
    ${cssLinks}
    <style>
      #storybook-root[hidden],
      #storybook-docs[hidden] {
        display: none !important;
      }
    </style>
  </head>
  <body>
    ${bodyHtmlSnippet || ''}
    <div id="storybook-root"></div>
    <div id="storybook-docs"></div>
    ${globalsScript}
    <script type="module">
      import './sb-preview/runtime.js';
      ${jsImports}
    </script>
  </body>
</html>`;
        },
      }),
      new DefinePlugin({
        'process.env': `(${JSON.stringify(envs)})`,
        ...stringifyProcessEnvs(envs),
        NODE_ENV: JSON.stringify(
          (features as any)?.developmentModeForBuild && isProd ? 'development' : process.env.NODE_ENV
        ),
      }),
      isProd ? null : new HotModuleReplacementPlugin(),
      quiet ? null : new ProgressPlugin({ modulesCount } as any),
    ].filter(Boolean) as any,
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'typescript',
                    tsx: true,
                  },
                  transform: {
                    react: {
                      runtime: 'automatic',
                    },
                  },
                },
              },
            },
          ],
        },
        {
          test: /\.(jsx)$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'ecmascript',
                    jsx: true,
                  },
                  transform: {
                    react: {
                      runtime: 'automatic',
                    },
                  },
                },
              },
            },
          ],
        },
        {
          test: /\.stories\.([tj])sx?$|(stories|story)\.mdx$/,
          exclude: /node_modules/,
          enforce: 'post' as const,
          use: [
            {
              loader: fileURLToPath(
                import.meta.resolve('storybook-builder-rspack-unofficial/loaders/export-order-loader')
              ),
            },
          ],
        },
        {
          test: /\.m?js$/,
          type: 'javascript/auto' as const,
        },
        {
          test: /\.m?js$/,
          resolve: {
            fullySpecified: false,
          },
        },
        {
          test: /\.md$/,
          type: 'asset/source' as const,
        },
      ],
    },
    resolve: {
      extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json', '.cjs'],
      modules: ['node_modules'].concat((envs as any).NODE_PATH || []),
      mainFields: ['browser', 'module', 'main'].filter(Boolean),
      symlinks: !isPreservingSymlinks(),
    },
    optimization: {
      splitChunks: {
        chunks: 'all' as const,
      },
      // Separate runtime chunk breaks rspack HMR: the runtime chunk ends up in
      // the hot-update manifest and applying it requires webpackHotUpdate* which
      // lives inside the runtime itself (circular). Keep runtime embedded in the
      // entry chunk in dev; extract it only for production (where HMR is off).
      runtimeChunk: isProd ? (true as const) : false,
      sideEffects: true,
      usedExports: (options as any).build?.test?.disableTreeShaking ? false : isProd,
      moduleIds: 'named' as const,
      ...(isProd
        ? {
            minimize: true,
            minimizer: [
              new rspackModule.SwcJsMinimizerRspackPlugin({
                minimizerOptions: {
                  mangle: false,
                  compress: {
                    keep_fnames: true,
                  },
                },
              }),
            ],
          }
        : {}),
    },
    performance: {
      hints: isProd ? ('warning' as const) : false,
    },
    ...cacheConfig,
    ...lazyCompilationConfig,
  } as Configuration;
};
