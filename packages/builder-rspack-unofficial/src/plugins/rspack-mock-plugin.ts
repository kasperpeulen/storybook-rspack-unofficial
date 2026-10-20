import { dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  findMockRedirect,
  getIsExternal,
  resolveExternalModule,
  resolveWithExtensions,
} from 'storybook/internal/mocking-utils';

import type { Compiler } from '@rspack/core';
import { rspack } from '@rspack/core';

import { extractMockCalls } from '../mocking-utils.js';

// --- Type Definitions ---

/** Options for configuring the RspackMockPlugin. */
export interface RspackMockPluginOptions {
  previewConfigPath: string;
}

/** Represents a single `sb.mock()` call extracted directly from the AST. */
interface ExtractedMock {
  path: string;
  spy: boolean;
}

/** Represents a fully processed mock, with resolved paths and its replacement resource. */
interface ResolvedMock extends ExtractedMock {
  absolutePath: string;
  replacementResource: string;
}

const PLUGIN_NAME = 'storybook-mock-plugin';

/**
 * An Rspack plugin that enables module mocking for Storybook. It scans the preview config for
 * `sb.mock()` calls and uses NormalModuleReplacementPlugin to substitute the original
 * modules with mocks.
 */
export class RspackMockPlugin {
  private readonly options: RspackMockPluginOptions;
  private mockMap: Map<string, ResolvedMock> = new Map();

  constructor(options: RspackMockPluginOptions) {
    if (!options.previewConfigPath) {
      throw new Error(`[${PLUGIN_NAME}] \`previewConfigPath\` is required.`);
    }
    this.options = options;
  }

  public apply(compiler: Compiler): void {
    const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);

    const updateMocks = () => {
      this.mockMap = new Map(
        this.extractAndResolveMocks(compiler).flatMap((mock) => [
          [mock.absolutePath, mock],
          [mock.absolutePath.replace(/\.[^.]+$/, ''), mock],
        ])
      );
      logger.info(`Mock map updated with ${this.mockMap.size / 2} mocks.`);
    };

    compiler.hooks.beforeRun.tap(PLUGIN_NAME, updateMocks); // for build
    compiler.hooks.watchRun.tap(PLUGIN_NAME, updateMocks); // for dev

    // Use NormalModuleReplacementPlugin from @rspack/core
    new rspack.NormalModuleReplacementPlugin(/.*/, (resource: any) => {
      try {
        const path = resource.request;
        const importer = resource.context;

        const isExternal = getIsExternal(path, importer);
        const absolutePath = isExternal
          ? resolveExternalModule(path, importer)
          : resolveWithExtensions(path, importer);

        if (this.mockMap.has(absolutePath)) {
          resource.request = this.mockMap.get(absolutePath)!.replacementResource;
        }
      } catch (e) {
        logger.debug(`Could not resolve mock for "${resource.request}".`);
      }
    }).apply(compiler);

    compiler.hooks.afterCompile.tap(PLUGIN_NAME, (compilation) => {
      compilation.fileDependencies.add(this.options.previewConfigPath);

      for (const mock of this.mockMap.values()) {
        if (
          isAbsolute(mock.replacementResource) &&
          mock.replacementResource.includes('__mocks__')
        ) {
          compilation.contextDependencies.add(dirname(mock.replacementResource));
        }
      }
    });
  }

  private extractAndResolveMocks(compiler: Compiler): ResolvedMock[] {
    const { previewConfigPath } = this.options;
    const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);

    const mocks = extractMockCalls(
      { previewConfigPath, configDir: dirname(previewConfigPath) },
      compiler.context,
      findMockRedirect
    );

    const resolvedMocks: ResolvedMock[] = [];
    for (const mock of mocks) {
      try {
        const { absolutePath, redirectPath } = mock;

        let replacementResource: string;

        if (redirectPath) {
          replacementResource = redirectPath;
        } else {
          const loaderPath = fileURLToPath(
            import.meta.resolve('storybook-builder-rspack-unofficial/loaders/rspack-automock-loader')
          );
          replacementResource = `${loaderPath}?spy=${mock.spy}!${absolutePath}`;
        }

        resolvedMocks.push({
          ...mock,
          replacementResource,
        });
      } catch (e) {
        logger.warn(`Could not resolve mock for "${mock.path}". It will be ignored.`);
      }
    }

    return resolvedMocks;
  }
}
