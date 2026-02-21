import { cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { PREVIEW_BUILDER_PROGRESS } from 'storybook/internal/core-events';
import { logger } from 'storybook/internal/node-logger';
import type { Builder, Options } from 'storybook/internal/types';

import { dirname, join, parse } from 'pathe';
import prettyTime from 'pretty-hrtime';
import { rspack as rspackModule } from '@rspack/core';
import type { Configuration, Stats, StatsOptions } from '@rspack/core';
import sirv from 'sirv';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';

export * from './types';
export * from './preview/virtual-module-mapping';

const { DefinePlugin, IgnorePlugin, ProgressPlugin } = rspackModule;

export const RspackDefinePlugin = DefinePlugin;
export const RspackIgnorePlugin = IgnorePlugin;

// Simple error classes instead of importing from storybook internals
export class RspackCompilationError extends Error {
  constructor({ errors }: { errors: { message: string }[] }) {
    super(
      `Rspack compilation failed:\n${errors.map((e) => e.message).join('\n')}`
    );
    this.name = 'RspackCompilationError';
  }
}

export class RspackInvocationError extends Error {
  constructor({ error }: { error: Error }) {
    super(error.message);
    this.name = 'RspackInvocationError';
    this.stack = error.stack;
  }
}

export class RspackMissingStatsError extends Error {
  constructor() {
    super('Rspack stats are missing or have been configured incorrectly.');
    this.name = 'RspackMissingStatsError';
  }
}

export const printDuration = (startTime: [number, number]) =>
  prettyTime(process.hrtime(startTime))
    .replace(' ms', ' milliseconds')
    .replace(' s', ' seconds')
    .replace(' min', ' minutes');

const corePath = dirname(fileURLToPath(import.meta.resolve('storybook/package.json')));

let compilation: ReturnType<typeof webpackDevMiddleware> | undefined;
let reject: (reason?: any) => void;

type RspackBuilder = Builder<Configuration, Stats>;
type Unpromise<T extends Promise<any>> = T extends Promise<infer U> ? U : never;

type BuilderStartOptions = Parameters<RspackBuilder['start']>['0'];
type BuilderStartResult = Unpromise<ReturnType<RspackBuilder['start']>>;
type StarterFunction = (
  options: BuilderStartOptions
) => AsyncGenerator<unknown, BuilderStartResult, void>;

type BuilderBuildOptions = Parameters<RspackBuilder['build']>['0'];
type BuilderBuildResult = Unpromise<ReturnType<RspackBuilder['build']>>;
type BuilderFunction = (
  options: BuilderBuildOptions
) => AsyncGenerator<Stats | undefined, BuilderBuildResult, void>;

export const executor = {
  get: async (options: Options) => {
    const rspackInstance =
      (await options.presets.apply<typeof rspackModule>('rspackInstance')) || rspackModule;
    return rspackInstance;
  },
};

export const getConfig: RspackBuilder['getConfig'] = async (options) => {
  const { presets } = options;
  const typescriptOptions = await presets.apply('typescript', {}, options);
  const frameworkOptions = await presets.apply<any>('frameworkOptions');

  return presets.apply(
    'rspack',
    {},
    {
      ...options,
      typescriptOptions,
      frameworkOptions,
    }
  ) as any;
};

let asyncIterator: ReturnType<StarterFunction> | ReturnType<BuilderFunction>;

export const bail: RspackBuilder['bail'] = async () => {
  if (asyncIterator) {
    try {
      await asyncIterator.throw(new Error());
    } catch (e) {
      //
    }
  }

  if (reject) {
    reject();
  }
  return new Promise((res, rej) => {
    if (process && compilation) {
      try {
        compilation.close(() => res());
        logger.warn('Force closed preview build');
      } catch (err) {
        logger.warn('Unable to close preview build!');
        res();
      }
    } else {
      res();
    }
  });
};

const starter: StarterFunction = async function* starterGeneratorFn({
  startTime,
  options,
  router,
  channel,
}) {
  const rspackInstance = await executor.get(options);
  yield;

  const config = await getConfig(options);

  if (config.stats === 'none' || config.stats === 'summary') {
    throw new RspackMissingStatsError();
  }
  yield;

  const compiler = rspackInstance(config);

  if (!compiler) {
    throw new RspackInvocationError({
      error: new Error(`Missing Rspack compiler at runtime!`),
    });
  }

  yield;
  const modulesCount = await options.cache?.get('modulesCount', 1000);
  let totalModules: number;
  let value = 0;

  new ProgressPlugin({
    handler: (newValue: number, message: string, arg3?: string) => {
      value = Math.max(newValue, value);
      const progress = { value, message: message.charAt(0).toUpperCase() + message.slice(1) };
      if (message === 'building') {
        const counts = (typeof arg3 === 'string' && arg3.match(/entries (\d+)\/(\d+)/)) || [];
        const complete = parseInt(counts[1], 10);
        const total = parseInt(counts[2], 10);
        if (!Number.isNaN(complete) && !Number.isNaN(total)) {
          (progress as any).modules = { complete, total };
          totalModules = total;
        }
      }

      if (value === 1) {
        if (options.cache) {
          options.cache.set('modulesCount', totalModules);
        }

        if (!progress.message) {
          progress.message = `Completed in ${printDuration(startTime)}.`;
        }
      }

      channel.emit(PREVIEW_BUILDER_PROGRESS, progress);
    },
    modulesCount,
  } as any).apply(compiler);

  const middlewareOptions: Parameters<typeof webpackDevMiddleware>[1] = {
    publicPath: config.output?.publicPath as string,
    writeToDisk: true,
    stats: 'errors-only',
  };

  compilation = webpackDevMiddleware(compiler as any, middlewareOptions);

  const previewResolvedDir = join(corePath, 'dist/preview');
  router.use(
    '/sb-preview',
    sirv(previewResolvedDir, {
      maxAge: 300000,
      dev: true,
      immutable: true,
    })
  );

  router.use(compilation);
  router.use(webpackHotMiddleware(compiler as any, { log: false }));

  const stats = await new Promise<Stats>((res, rej) => {
    compilation?.waitUntilValid(res as any);
    reject = rej;
  });
  yield;

  if (!stats) {
    throw new RspackMissingStatsError();
  }

  const { warnings, errors } = getRspackStats({ config, stats });

  if (warnings.length > 0) {
    warnings?.forEach((e) => logger.warn(e.message));
  }

  if (errors.length > 0) {
    throw new RspackCompilationError({ errors });
  }

  return {
    bail,
    stats,
    totalTime: process.hrtime(startTime),
  };
};

function getRspackStats({ config, stats }: { config: Configuration; stats: Stats }) {
  const statsOptions =
    typeof config.stats === 'string'
      ? config.stats
      : {
          ...(config.stats as StatsOptions),
          warnings: true,
          errors: true,
        };
  const { warnings = [], errors = [] } = stats?.toJson(statsOptions) || {};
  return {
    warnings,
    errors,
  };
}

const builder: BuilderFunction = async function* builderGeneratorFn({ startTime, options }) {
  const rspackInstance = await executor.get(options);
  yield;
  const config = await getConfig(options);

  if (config.stats === 'none' || config.stats === 'summary') {
    throw new RspackMissingStatsError();
  }
  yield;

  const compiler = rspackInstance(config);

  if (!compiler) {
    throw new RspackInvocationError({
      error: new Error(`Missing Rspack compiler at runtime!`),
    });
  }

  const rspackCompilation = new Promise<Stats>((succeed, fail) => {
    compiler.run((error, stats) => {
      if (error) {
        compiler.close(() => fail(new RspackInvocationError({ error })));
        return;
      }

      if (!stats) {
        throw new RspackMissingStatsError();
      }

      const { warnings, errors } = getRspackStats({ config, stats });

      if (warnings.length > 0) {
        warnings?.forEach((e) => logger.warn(e.message));
      }

      if (errors.length > 0) {
        errors.forEach((e) => logger.error(e.message));
        compiler.close(() => fail(new RspackCompilationError({ errors })));
        return;
      }

      compiler.close((closeErr) => {
        if (closeErr) {
          return fail(new RspackInvocationError({ error: closeErr }));
        }

        return succeed(stats as Stats);
      });
    });
  });

  const previewResolvedDir = join(corePath, 'dist/preview');
  const previewDirTarget = join(options.outputDir || '', `sb-preview`);
  const previewFiles = cp(previewResolvedDir, previewDirTarget, {
    filter: (src) => {
      const { ext } = parse(src);
      if (ext) {
        return ext === '.js';
      }
      return true;
    },
    recursive: true,
  });

  const [rspackCompilationOutput] = await Promise.all([rspackCompilation, previewFiles]);

  return rspackCompilationOutput;
};

export const start = async (options: BuilderStartOptions) => {
  asyncIterator = starter(options);
  let result;

  do {
    result = await asyncIterator.next();
  } while (!result.done);

  return result.value;
};

export const build = async (options: BuilderStartOptions) => {
  asyncIterator = builder(options);
  let result;

  do {
    result = await asyncIterator.next();
  } while (!result.done);

  return result.value;
};

export const corePresets = [
  import.meta.resolve('storybook-builder-rspack/presets/preview-preset'),
];
export const overridePresets = [
  import.meta.resolve('storybook-builder-rspack/presets/custom-rspack-preset'),
];
