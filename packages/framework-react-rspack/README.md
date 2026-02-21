# storybook-react-rspack

Storybook framework for React projects using [Rspack](https://rspack.dev/) as the bundler.

Combines [`storybook-builder-rspack`](../builder-rspack) with `@storybook/react` renderer.

## Installation

```bash
npm install storybook-react-rspack @rspack/core --save-dev
```

## Usage

`.storybook/main.ts`:

```ts
import type { StorybookConfig } from 'storybook-react-rspack';

const config: StorybookConfig = {
  framework: 'storybook-react-rspack',
  stories: ['../src/**/*.stories.@(ts|tsx|js|jsx)'],
};

export default config;
```

## Peer Dependencies

- `@rspack/core` ^1.0.0
- `react` ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
- `react-dom` ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
- `storybook` ^10.0.0

## License

MIT
