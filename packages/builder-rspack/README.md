# storybook-builder-rspack

Storybook builder that uses [`@rspack/core`](https://rspack.dev/) directly — a fast, webpack-compatible bundler.

This is a port of `@storybook/builder-webpack5` for Storybook 10, replacing webpack with rspack while maintaining full feature parity.

## Installation

```bash
npm install storybook-builder-rspack @rspack/core --save-dev
```

Most users should install [`storybook-react-rspack`](../framework-react-rspack) instead, which bundles this builder with the React renderer.

## What's included

- `rspack.HtmlRspackPlugin` instead of `html-webpack-plugin`
- `rspack.SwcJsMinimizerRspackPlugin` instead of `terser-webpack-plugin`
- `rspack.experiments.VirtualModulesPlugin` instead of `webpack-virtual-modules`
- Built-in SWC loader for TypeScript/JSX
- CSS and asset loading via `css-loader` + `style-loader`

## Peer Dependencies

- `@rspack/core` ^1.0.0
- `storybook` ^10.0.0

## License

MIT
