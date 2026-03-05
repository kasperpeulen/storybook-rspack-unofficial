import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { createFilter } from '@rollup/pluginutils';
import type * as docGen from 'react-docgen-typescript';
import type ts from 'typescript';
import type { Compiler } from '@rspack/core';
import { logger } from 'storybook/internal/node-logger';

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

    const filter = createFilter(include, exclude.length ? exclude : undefined);

    // Resolve worker path via package exports
    let workerPath: string;
    try {
      workerPath = fileURLToPath(
        import.meta.resolve('storybook-react-rspack/plugins/react-docgen-typescript-worker')
      );
    } catch {
      workerPath = require.resolve('storybook-react-rspack/plugins/react-docgen-typescript-worker');
    }

    const worker = new Worker(workerPath);

    // Track pending requests
    let nextId = 0;
    const pending = new Map<number, { resolve: (v: { code: string; map: any } | null) => void; reject: (e: Error) => void }>();
    let ready = false;
    const queue: Array<{ id: number; resourcePath: string; source: string }> = [];

    worker.on('message', (msg: any) => {
      switch (msg.type) {
        case 'ready':
          ready = true;
          for (const queued of queue) {
            worker.postMessage({ type: 'process', ...queued });
          }
          queue.length = 0;
          break;

        case 'result': {
          const entry = pending.get(msg.id);
          if (entry) {
            pending.delete(msg.id);
            entry.resolve(msg.result);
          }
          break;
        }

        case 'log':
          if (msg.level === 'warn') {
            logger.warn(`${PLUGIN_NAME}: ${msg.message}`);
          } else {
            logger.info(`${PLUGIN_NAME}: ${msg.message}`);
          }
          break;
      }
    });

    worker.on('error', (err) => {
      logger.error(`${PLUGIN_NAME}: worker error: ${err}`);
      for (const entry of pending.values()) {
        entry.reject(err);
      }
      pending.clear();
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        const err = new Error(`${PLUGIN_NAME}: worker exited with code ${code}`);
        for (const entry of pending.values()) {
          entry.reject(err);
        }
        pending.clear();
      }
    });

    // Strip non-serializable (function) values — propFilter, componentNameResolver
    // cannot be cloned across worker threads
    const serializableDocgenOptions = Object.fromEntries(
      Object.entries(docgenOptions).filter(([, v]) => typeof v !== 'function')
    );

    worker.postMessage({
      type: 'init',
      options: {
        compilerOptions: userCompilerOptions,
        setDisplayName,
        typePropName,
        docgenOptions: serializableDocgenOptions,
        compilerContext: compiler.context,
      },
    });

    compiler.hooks.shutdown.tapPromise(PLUGIN_NAME, async () => {
      worker.postMessage({ type: 'shutdown' });
      await worker.terminate();
    });

    (compiler as any)[HANDLER_KEY] = (
      resourcePath: string,
      source: string,
    ): Promise<{ code: string; map: any } | null> => {
      if (!filter(resourcePath)) return Promise.resolve(null);

      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        const msg = { id, resourcePath, source };
        if (ready) {
          worker.postMessage({ type: 'process', ...msg });
        } else {
          queue.push(msg);
        }
      });
    };
  }
}
