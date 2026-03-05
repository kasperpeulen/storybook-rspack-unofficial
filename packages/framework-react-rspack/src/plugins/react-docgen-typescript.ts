import { createRequire } from 'node:module';
import { createFilter } from '@rollup/pluginutils';
import * as docGen from 'react-docgen-typescript';
import ts from 'typescript';
import type { Compiler } from '@rspack/core';
import { generateDocgenCodeBlock, type GeneratorOptions } from './generateDocgenCodeBlock';

const require = createRequire(import.meta.url);

export type PluginOptions = docGen.ParserOptions & {
  compilerOptions?: ts.CompilerOptions;
  exclude?: string[];
  include?: string[];
  setDisplayName?: boolean;
  typePropName?: string;
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

    const getProgram = (resourcePath: string): ts.Program => {
      projectService.openClientFile(resourcePath);

      const scriptInfo = projectService.getScriptInfo(resourcePath);
      if (!scriptInfo) {
        throw new Error(`${PLUGIN_NAME}: no script info for ${resourcePath}`);
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

    (compiler as any)[HANDLER_KEY] = (
      resourcePath: string,
      source: string,
    ): { code: string; map: any } | null => {
      if (!filter(resourcePath)) return null;

      try {
        const program = getProgram(resourcePath);
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
