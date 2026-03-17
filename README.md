# Storybook Rspack (Unofficial)

A [Storybook](https://storybook.js.org/) builder powered by [Rspack](https://rspack.dev/) — a drop-in replacement for `@storybook/builder-webpack5` that uses `@rspack/core` directly for significantly faster builds.

## Motivation

If you're using webpack-based Storybook and want to speed up your builds with Rspack, the existing option is [storybook-rsbuild](https://github.com/rstackjs/storybook-rsbuild) — which routes through [Rsbuild](https://rsbuild.dev/) (a higher-level build tool on top of Rspack).

This project takes a different approach: it uses **`@rspack/core` directly**, without the Rsbuild layer. This means:

- **Minimal abstraction** — the rspack config is yours to control, just like `@storybook/builder-webpack5` gives you the raw webpack config. If you're migrating from webpack, the mental model is the same.
- **Direct rspack API access** — `rspackFinal` gives you the full `@rspack/core` `Configuration` object. No Rsbuild plugin system to learn.
- **Lighter dependency tree** — no Rsbuild, no `@rsbuild/core`, just `@rspack/core` as a peer dependency.
- **Better `react-docgen-typescript` implementation** — storybook-rsbuild runs TypeScript type-checking on the main thread using `createWatchProgram`, which blocks the build and spawns file watchers for every file in the project (on top of rspack's own watchers). This project offloads docgen to a **worker thread** using TypeScript's `ProjectService` API — docgen runs in parallel without blocking rspack compilation, no duplicate watchers are created, and the type checker is eagerly warmed up on startup for faster first builds.

storybook-rsbuild [does work with Rspack projects](https://github.com/rstackjs/storybook-rsbuild/issues/92), but it still routes through Rsbuild. If you prefer the convenience and opinionated defaults that Rsbuild provides, use [storybook-rsbuild](https://github.com/rstackjs/storybook-rsbuild). If you want direct control over rspack (or are migrating an existing webpack config), this project is for you.

## Features

- Uses `@rspack/core` directly — no extra abstraction layers
- Full Storybook 10 compatibility
- Built-in TypeScript/JSX support via SWC
- HMR via `webpack-hot-middleware` (rspack-compatible)
- CSS, assets, and static files work out of the box
- `rspackFinal` hook — same pattern as `webpackFinal`, full control over the config
- React docgen support — both `react-docgen` and `react-docgen-typescript` for auto-generated props tables

## Packages

| Package | Description |
|---|---|
| [`storybook-builder-rspack-unofficial`](./packages/builder-rspack-unofficial) | Rspack builder for Storybook |
| [`storybook-react-rspack-unofficial`](./packages/framework-react-rspack-unofficial) | React framework using the rspack builder |

## Quick Start

```bash
npm install storybook-react-rspack-unofficial @rspack/core --save-dev
```

Configure `.storybook/main.ts`:

```ts
import type { StorybookConfig } from 'storybook-react-rspack-unofficial';

const config: StorybookConfig = {
  framework: 'storybook-react-rspack-unofficial',
  stories: ['../src/**/*.stories.@(ts|tsx|js|jsx)'],
};

export default config;
```

Run Storybook:

```bash
npx storybook dev -p 6006
```

## Configuration

### Custom rspack config

Use `rspackFinal` in your `.storybook/main.ts` to customize the rspack configuration:

```ts
import type { StorybookConfig } from 'storybook-react-rspack-unofficial';

const config: StorybookConfig = {
  framework: 'storybook-react-rspack-unofficial',
  stories: ['../src/**/*.stories.@(ts|tsx|js|jsx)'],
  async rspackFinal(config) {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': new URL('../src', import.meta.url).pathname,
    };
    return config;
  },
};

export default config;
```

### Builder options

```ts
const config: StorybookConfig = {
  framework: {
    name: 'storybook-react-rspack-unofficial',
    options: {
      builder: {
        fsCache: true,        // Enable filesystem cache
        lazyCompilation: true, // Enable lazy compilation in dev
      },
    },
  },
};
```

## Requirements

- Node.js 20.19+ or 22.12+
- Storybook 10
- `@rspack/core` ^1.0.0

## License

MIT
