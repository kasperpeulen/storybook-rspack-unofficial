import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Options } from 'storybook/internal/types';

const storybookEntries = ['storybook-entry.js'];
const configEntryPath = resolve(process.cwd(), 'storybook-config-entry.js');

const storiesConfig = [
  {
    directory: './stories',
    files: '*.stories.tsx',
    titlePrefix: '',
  },
];

vi.mock('@rspack/core', () => {
  const stub = (name: string) =>
    class {
      constructor(public options?: any) {}
      static name = name;
    };

  return {
    rspack: {
      DefinePlugin: stub('DefinePlugin'),
      HotModuleReplacementPlugin: stub('HotModuleReplacementPlugin'),
      ProgressPlugin: stub('ProgressPlugin'),
      HtmlRspackPlugin: stub('HtmlRspackPlugin'),
      SwcJsMinimizerRspackPlugin: stub('SwcJsMinimizerRspackPlugin'),
      experiments: {
        VirtualModulesPlugin: stub('VirtualModulesPlugin'),
      },
    },
  };
});

vi.mock('storybook/internal/common', () => ({
  getBuilderOptions: vi.fn().mockResolvedValue({
    fsCache: false,
    lazyCompilation: false,
  }),
  normalizeStories: vi.fn().mockReturnValue(storiesConfig),
  stringifyProcessEnvs: vi.fn().mockReturnValue({}),
  isPreservingSymlinks: vi.fn().mockReturnValue(false),
}));

vi.mock('storybook/internal/preview/globals', () => ({
  globalsNameReferenceMap: {},
}));

vi.mock('../../src/preview/virtual-module-mapping', () => ({
  getVirtualModules: vi.fn().mockResolvedValue({
    virtualModules: { '/virtual/module.js': 'export default {}' },
    entries: [configEntryPath],
  }),
}));

const { getBuilderOptions } = await import('storybook/internal/common');

const createOptions = (overrides: Record<string, unknown> = {}) => {
  const presetValues = new Map<string, unknown>([
    [
      'core',
      {
        builder: {
          name: 'storybook-builder-rspack',
          options: { fsCache: false, lazyCompilation: false },
        },
      },
    ],
    ['framework', {}],
    ['frameworkOptions', { renderer: '@storybook/react' }],
    ['env', { STORYBOOK_ENV: 'development' }],
    ['logLevel', 'info'],
    ['previewHead', '<!-- head -->'],
    ['previewBody', '<!-- body -->'],
    [
      'previewMainTemplate',
      '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
    ],
    ['docs', {}],
    ['entries', storybookEntries],
    ['stories', storiesConfig],
    ['tags', {}],
    ['build', { test: {} }],
    ['previewAnnotations', []],
  ]);

  const apply = vi.fn(
    async (name: string, defaultValue?: unknown): Promise<unknown> => {
      if (name === 'mdxLoaderOptions') {
        return defaultValue;
      }

      if (presetValues.has(name)) {
        return presetValues.get(name);
      }

      return defaultValue;
    },
  );

  const cache = {
    get: vi.fn((_key: string, fallback: number) => fallback),
  };

  const options = {
    configType: 'DEVELOPMENT',
    quiet: true,
    outputDir: 'storybook-static',
    packageJson: { version: '10.0.0-test' },
    presets: { apply },
    previewUrl: 'http://localhost:6006/iframe.html',
    typescriptOptions: {
      check: false,
      skipCompiler: true,
    },
    features: {},
    cache,
    configDir: process.cwd(),
    build: {},
    ...overrides,
  } as unknown as Options & { typescriptOptions: any };

  return { options, apply };
};

describe('iframe-rspack.config', () => {
  it('entry array contains storybook entries + dynamic entries', async () => {
    const createIframeRspackConfig = (
      await import('../../src/preview/iframe-rspack.config')
    ).default;
    const { options } = createOptions();

    const config = await createIframeRspackConfig(options);

    expect(config.entry).toContain(storybookEntries[0]);
    expect(config.entry).toContain(configEntryPath);
  });

  it('works without cache option', async () => {
    const createIframeRspackConfig = (
      await import('../../src/preview/iframe-rspack.config')
    ).default;
    const { options } = createOptions({ cache: undefined });

    const config = await createIframeRspackConfig(options);

    expect(config.entry).toBeDefined();
  });

  it('experiments is empty when lazyCompilation is falsy', async () => {
    const createIframeRspackConfig = (
      await import('../../src/preview/iframe-rspack.config')
    ).default;
    vi.mocked(getBuilderOptions).mockResolvedValueOnce({
      lazyCompilation: false,
      fsCache: false,
    });
    const { options } = createOptions();

    const config = await createIframeRspackConfig(options);

    expect(config.experiments).toEqual({});
  });

  it('experiments has lazyCompilation when lazyCompilation is truthy', async () => {
    const createIframeRspackConfig = (
      await import('../../src/preview/iframe-rspack.config')
    ).default;
    vi.mocked(getBuilderOptions).mockResolvedValueOnce({
      lazyCompilation: true,
      fsCache: false,
    });
    const { options } = createOptions();

    const config = await createIframeRspackConfig(options);

    expect(config.experiments).toEqual({ lazyCompilation: { entries: false } });
  });

  it('has cache filesystem config when fsCache is true', async () => {
    const createIframeRspackConfig = (
      await import('../../src/preview/iframe-rspack.config')
    ).default;
    vi.mocked(getBuilderOptions).mockResolvedValueOnce({
      lazyCompilation: false,
      fsCache: true,
    });
    const { options } = createOptions();

    const config = await createIframeRspackConfig(options);

    expect((config as any).cache).toEqual({ type: 'filesystem' });
  });

  it('mode is development when configType is DEVELOPMENT', async () => {
    const createIframeRspackConfig = (
      await import('../../src/preview/iframe-rspack.config')
    ).default;
    const { options } = createOptions({ configType: 'DEVELOPMENT' });

    const config = await createIframeRspackConfig(options);

    expect(config.mode).toBe('development');
  });

  it('mode is production when configType is PRODUCTION', async () => {
    const createIframeRspackConfig = (
      await import('../../src/preview/iframe-rspack.config')
    ).default;
    vi.mocked(getBuilderOptions).mockResolvedValueOnce({
      lazyCompilation: false,
      fsCache: false,
    });
    const { options } = createOptions({ configType: 'PRODUCTION' });

    const config = await createIframeRspackConfig(options);

    expect(config.mode).toBe('production');
  });
});
