import { createRequire } from 'node:module';
import { parentPort } from 'node:worker_threads';
import * as docGen from 'react-docgen-typescript';
import ts from 'typescript';
import { generateDocgenCodeBlock } from './generateDocgenCodeBlock';

const require = createRequire(import.meta.url);

const VALID_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

let docGenParser: docGen.FileParser;
let projectService: any;
let generateOptions: { setDisplayName: boolean; typePropName: string };

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

function getProgram(resourcePath: string, source: string): ts.Program {
  projectService.openClientFile(resourcePath, source);

  const scriptInfo = projectService.getScriptInfo(resourcePath);
  if (!scriptInfo) {
    throw new Error(`ReactDocgenTypescriptPlugin: no script info for ${resourcePath}`);
  }

  const snapshot = scriptInfo.getSnapshot();
  if (snapshot.getText(0, snapshot.getLength()) !== source) {
    scriptInfo.editContent(0, snapshot.getLength(), source);
  }

  const project = projectService.getDefaultProjectForFile(scriptInfo.fileName, true);
  if (!project) {
    throw new Error(`ReactDocgenTypescriptPlugin: no project for ${resourcePath}`);
  }

  const program = project.getLanguageService(true)?.getProgram();
  if (!program) {
    throw new Error(`ReactDocgenTypescriptPlugin: failed to get program for ${resourcePath}`);
  }

  return program;
}

function processFile(resourcePath: string, source: string): { code: string; map: any } | null {
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
}

parentPort!.on('message', (msg: any) => {
  switch (msg.type) {
    case 'init': {
      const opts = msg.options;

      const compilerOptions: ts.CompilerOptions = {
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.Latest,
        ...opts.compilerOptions,
      };

      docGenParser = docGen.withCompilerOptions(compilerOptions, {
        shouldExtractLiteralValuesFromEnum: true,
        shouldRemoveUndefinedFromOptional: true,
        ...opts.docgenOptions,
      });

      generateOptions = {
        setDisplayName: opts.setDisplayName,
        typePropName: opts.typePropName,
      };

      projectService = createProjectService();

      // Eagerly warm up the type checker
      if (opts.compilerContext) {
        try {
          const files = ts.sys.readDirectory(opts.compilerContext, ['.tsx'], ['node_modules']);
          const seedFile = files[0];
          if (seedFile) {
            parentPort!.postMessage({
              type: 'log',
              level: 'info',
              message: 'warming up TypeScript type checker...',
            });
            const start = performance.now();
            getProgram(seedFile, ts.sys.readFile(seedFile) ?? '');
            parentPort!.postMessage({
              type: 'log',
              level: 'info',
              message: `type checker ready in ${((performance.now() - start) / 1000).toFixed(1)}s`,
            });
          }
        } catch (e) {
          parentPort!.postMessage({
            type: 'log',
            level: 'warn',
            message: `type checker warmup failed: ${e}`,
          });
        }
      }

      parentPort!.postMessage({ type: 'ready' });
      break;
    }

    case 'process': {
      const result = processFile(msg.resourcePath, msg.source);
      parentPort!.postMessage({ type: 'result', id: msg.id, result });
      break;
    }

    case 'shutdown': {
      projectService = null;
      process.exit(0);
      break;
    }
  }
});
