import { fileURLToPath } from 'node:url';

import rspackConfig from '../preview/iframe-rspack.config';

export const rspack = async (_: unknown, options: any) => rspackConfig(options);

export const entries = async (_: unknown, options: any) => {
  let result: string[] = [];

  if (options.configType === 'DEVELOPMENT') {
    // Suppress informational messages when --quiet is specified. webpack-hot-middleware's quiet
    // parameter would also suppress warnings.
    result = result.concat(
      `${fileURLToPath(
        import.meta.resolve('webpack-hot-middleware/client.js')
      )}?reload=true&quiet=false&overlay=${JSON.stringify({
        errors: true,
        warnings: false,
        runtimeErrors: false,
      })}&noInfo=${options.quiet}`
    );
  }

  return result;
};
