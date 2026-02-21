# Storybook Rspack

A [Storybook](https://storybook.js.org/) builder powered by [Rspack](https://rspack.dev/) — a drop-in replacement for `@storybook/builder-webpack5` that uses `@rspack/core` directly for significantly faster builds.

## Features

- Uses `@rspack/core` directly — no extra abstraction layers
- Full Storybook 10 compatibility
- Built-in TypeScript/JSX support via SWC
- HMR via `webpack-hot-middleware` (rspack-compatible)
- CSS, assets, and static files work out of the box

## Packages

| Package | Description |
|---|---|
| [`storybook-builder-rspack`](./packages/builder-rspack) | Rspack builder for Storybook |
| [`storybook-react-rspack`](./packages/framework-react-rspack) | React framework using the rspack builder |

## Quick Start

```bash
npm install storybook-react-rspack @rspack/core --save-dev
```

Configure `.storybook/main.ts`:

```ts
import type { StorybookConfig } from 'storybook-react-rspack';

const config: StorybookConfig = {
  framework: 'storybook-react-rspack',
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
import type { StorybookConfig } from 'storybook-react-rspack';

const config: StorybookConfig = {
  framework: 'storybook-react-rspack',
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
    name: 'storybook-react-rspack',
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
