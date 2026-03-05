import type { LoaderContext } from '@rspack/core';

const HANDLER_KEY = '__reactDocgenHandler';

export default function reactDocgenTypescriptLoader(
  this: LoaderContext,
  source: string,
  map: any,
) {
  const callback = this.async();
  const handler: ((path: string, src: string) => { code: string; map: any } | null) | undefined =
    (this._compiler as any)?.[HANDLER_KEY];

  if (!handler) {
    callback(null, source, map);
    return;
  }

  try {
    const result = handler(this.resourcePath, source);
    if (!result) {
      callback(null, source, map);
      return;
    }
    callback(null, result.code, result.map ?? map);
  } catch {
    callback(null, source, map);
  }
}
