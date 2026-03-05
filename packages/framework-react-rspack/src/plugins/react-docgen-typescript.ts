import { createRequire } from 'node:module';
import { createFilter } from '@rollup/pluginutils';
import * as docGen from 'react-docgen-typescript';
import ts from 'typescript';
import type { Compiler } from '@rspack/core';
import { logger } from 'storybook/internal/node-logger';
import { generateDocgenCodeBlock, type GeneratorOptions } from './generateDocgenCodeBlock';

const require = createRequire(import.meta.url);

export type PluginOptions = docGen.ParserOptions & {
  compilerOptions?: ts.CompilerOptions;
  exclude?: string[];
  include?: string[];
  setDisplayName?: boolean;
  typePropName?: string;
  warmup?: boolean;
};

const PLUGIN_NAME = 'ReactDocgenTypescriptPlugin';
const HANDLER_KEY = '__reactDocgenHandler';
const VALID_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function createProjectService() {
  const tsserver = require('typescript/lib/tsserverlibrary') as {
    server: { ProjectService: new (opts: any) => any };
  };

  return new tsserver.server.ProjectService({
    host: {
      ...ts.sys,
      watchFile: () => ({ close: () => {} }),
      watchDirectory: () => ({ close: () => {} }),
    },
    cancellationToken: { isCancellationRequested: () => false },
    useSingleInferredProject: false,
    useInferredProjectPerProjectRoot: true,
    typingsInstaller: {
      enqueueInstallTypingsRequest: () => {},
      attach: () => {},
      onProjectClosed: () => {},
      globalTypingsCacheLocation: undefined,
    },
    logger: {
      close: () => {},
      hasLevel: () => false,
      loggingEnabled: () => false,
      perftrc: () => {},
      info: () => {},
      startGroup: () => {},
      endGroup: () => {},
      msg: () => {},
      getLogFileName: () => undefined,
    },
    session: undefined,
  });
}

export class ReactDocgenTypescriptPlugin {
  private options: PluginOptions;

  constructor(options: PluginOptions = {}) {
    this.options = options;
  }

  apply(compiler: Compiler): void {
    const {
      compilerOptions: userCompilerOptions,
      setDisplayName = false,
      typePropName = 'type',
      exclude = [],
      include = ['**/*.tsx'],
      warmup = false,
      ...docgenOptions
    } = this.options;

    const compilerOptions: ts.CompilerOptions = {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.Latest,
      ...userCompilerOptions,
    };

    const docGenParser = docGen.withCompilerOptions(compilerOptions, {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      ...docgenOptions,
    });

    const filter = createFilter(include, exclude.length ? exclude : undefined);
    const generateOptions: Pick<GeneratorOptions, 'setDisplayName' | 'typePropName'> = {
      setDisplayName,
      typePropName,
    };

    let projectService: any = createProjectService();

    const getProgram = (resourcePath: string, source: string): ts.Program => {
      projectService.openClientFile(resourcePath, source);

      const scriptInfo = projectService.getScriptInfo(resourcePath);
      if (!scriptInfo) {
        throw new Error(`${PLUGIN_NAME}: no script info for ${resourcePath}`);
      }

      // Update content only when it changed (avoids version bump → program rebuild)
      const snapshot = scriptInfo.getSnapshot();
      if (snapshot.getText(0, snapshot.getLength()) !== source) {
        scriptInfo.editContent(0, snapshot.getLength(), source);
      }

      const project = projectService.getDefaultProjectForFile(scriptInfo.fileName, true);
      if (!project) {
        throw new Error(`${PLUGIN_NAME}: no project for ${resourcePath}`);
      }

      const program = project.getLanguageService(true)?.getProgram();
      if (!program) {
        throw new Error(`${PLUGIN_NAME}: failed to get program for ${resourcePath}`);
      }

      return program;
    };

    compiler.hooks.shutdown.tapPromise(PLUGIN_NAME, async () => {
      projectService = null;
    });

    // Warm up the type checker before first compilation (handles cached restarts)
    let warmedUp = false;
    compiler.hooks.beforeCompile.tap(PLUGIN_NAME, () => {
      if (warmedUp || !warmup || !projectService) return;
      warmedUp = true;

      try {
        const files = ts.sys.readDirectory(compiler.context, ['.tsx'], ['node_modules']);
        const seedFile = files.find((f) => filter(f));
        if (!seedFile || !projectService) return;
        logger.info(`${PLUGIN_NAME}: warming up TypeScript type checker...`);
        const start = performance.now();
        getProgram(seedFile, ts.sys.readFile(seedFile) ?? '');
        logger.info(`${PLUGIN_NAME}: type checker ready in ${((performance.now() - start) / 1000).toFixed(1)}s`);
      } catch (e) {
        logger.warn(`${PLUGIN_NAME}: type checker warmup failed: ${e}`);
      }
    });

    const seenSources = new Map<string, string>();

    (compiler as any)[HANDLER_KEY] = (
      resourcePath: string,
      source: string,
    ): { code: string; map: any } | null => {
      if (!filter(resourcePath)) return null;

      const prev = seenSources.get(resourcePath);
      if (prev === undefined) {
        logger.info(`${PLUGIN_NAME}: [handler] new file: ${resourcePath}`);
      } else if (prev === source) {
        logger.info(`${PLUGIN_NAME}: [handler] unchanged file: ${resourcePath}`);
      } else {
        logger.info(`${PLUGIN_NAME}: [handler] changed file: ${resourcePath}`);
      }
      seenSources.set(resourcePath, source);

      try {
        const program = getProgram(resourcePath, source);
        const componentDocs = docGenParser
          .parseWithProgramProvider(resourcePath, () => program)
          .filter((doc) => VALID_IDENTIFIER.test(doc.displayName));

        if (componentDocs.length) {
          return generateDocgenCodeBlock({
            filename: resourcePath,
            source,
            componentDocs,
            ...generateOptions,
          });
        }
      } catch {
        // silently skip docgen on error
      }

      return null;
    };
  }
}
