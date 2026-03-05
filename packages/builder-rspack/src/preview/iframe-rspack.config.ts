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

import { dedent } from 'ts-dedent';
import { rspack as rspackModule } from '@rspack/core';
import type { Configuration } from '@rspack/core';

import type { TypescriptOptions } from '../types';
import { getVirtualModules } from './virtual-module-mapping';

const { DefinePlugin, HotModuleReplacementPlugin, ProgressPlugin } = rspackModule;

class IframeHtmlPlugin {
  constructor(
    private filename: string,
    private generate: (files: { css: string[]; js: string[] }) => string
  ) {}

  apply(compiler: any) {
    compiler.hooks.compilation.tap('IframeHtmlPlugin', (compilation: any) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'IframeHtmlPlugin',
          stage: rspackModule.Compilation.PROCESS_ASSETS_STAGE_REPORT,
        },
        () => {
          const assetNames = Object.keys(compilation.assets);
          const css = assetNames.filter((n) => n.endsWith('.css'));
          const js = assetNames.filter((n) => n.endsWith('.js') && !n.includes('.hot-update.'));
          const html = this.generate({ css, js });
          compilation.emitAsset(this.filename, new rspackModule.sources.RawSource(html));
        }
      );
    });
  }
}

export default async (
  options: Options & { typescriptOptions: TypescriptOptions }
): Promise<Configuration> => {
  const {
    outputDir = join('.', 'public'),
    quiet,
    packageJson,
    configType,
    presets,
    previewUrl,
    typescriptOptions,
    features,
  } = options;

  const isProd = configType === 'PRODUCTION';
  const workingDir = process.cwd();

  const [
    coreOptions,
    frameworkOptions,
    envs,
    logLevel,
    headHtmlSnippet,
    bodyHtmlSnippet,
    template,
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
    presets.apply<string>('previewMainTemplate'),
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

  if (!template) {
    throw new Error(dedent`
      Storybook's Rspack builder requires a template to be specified.
      Somehow you've ended up with a falsy value for the template option.

      Please file an issue at https://github.com/nicostorybook/storybook-rspack with a reproduction.
    `);
  }

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
      new IframeHtmlPlugin('iframe.html', ({ css, js }) => {
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

        const cssLinks = css
          .map((file) => `<link href="${file}" rel="stylesheet" />`)
          .join('\n    ');

        const jsImports = js
          .map((file) => `import './${file}';`)
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
                import.meta.resolve('storybook-builder-rspack/loaders/export-order-loader')
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
