import { getMockerRuntime } from 'storybook/internal/mocking-utils';

import type { Compiler } from '@rspack/core';
import { rspack } from '@rspack/core';

const PLUGIN_NAME = 'RspackInjectMockerRuntimePlugin';

/**
 * An Rspack plugin that injects the module mocker runtime script into the preview iframe's HTML.
 * This ensures the `sb` object is available globally before any other scripts, including the
 * Storybook preview bundle, are executed.
 *
 * Since rspack uses HtmlRspackPlugin (built-in) instead of HtmlWebpackPlugin, we cannot use
 * HtmlWebpackPlugin.getHooks(). Instead, we hook into compilation.hooks.processAssets to emit
 * the mocker runtime as an asset, and then use HtmlRspackPlugin's hooks if available, or
 * modify the HTML output directly.
 */
export class RspackInjectMockerRuntimePlugin {
  public apply(compiler: Compiler): void {
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      // Use processAssets hook to inject the mocker runtime script
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        (assets) => {
          try {
            const runtimeScriptContent = getMockerRuntime();
            const runtimeAssetName = 'mocker-runtime-injected.js';

            // Emit the runtime script as an asset
            compilation.emitAsset(
              runtimeAssetName,
              new rspack.sources.RawSource(runtimeScriptContent)
            );
          } catch (error) {
            const logger = compilation.getLogger(PLUGIN_NAME);
            logger.warn(`Failed to inject mocker runtime: ${error}`);
          }
        }
      );

      // Hook into HtmlRspackPlugin to inject the script tag before other scripts
      // rspack's HtmlRspackPlugin supports afterTemplateExecution hook
      const hooks = (rspack.HtmlRspackPlugin as any).getCompilationHooks?.(compilation);
      if (hooks?.beforeAssetTagGeneration) {
        hooks.beforeAssetTagGeneration.tap(PLUGIN_NAME, (data: any) => {
          data.assets.js.unshift('mocker-runtime-injected.js');
          return data;
        });
      } else if (hooks?.afterTemplateExecution) {
        hooks.afterTemplateExecution.tap(PLUGIN_NAME, (data: any) => {
          // Insert the script tag at the beginning of the body
          const scriptTag = `<script src="mocker-runtime-injected.js"></script>`;
          if (data.html) {
            data.html = data.html.replace(
              /(<script\b)/i,
              `${scriptTag}\n$1`
            );
          }
          return data;
        });
      }
    });
  }
}
