import type { StorybookConfig } from 'storybook-react-rspack';

const config: StorybookConfig = {
  framework: 'storybook-react-rspack',
  stories: ['../src/**/*.stories.@(ts|tsx|js|jsx)'],
  async rspackFinal(config) {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@components': new URL('../src/components', import.meta.url).pathname,
    };
    return config;
  },
};

export default config;
