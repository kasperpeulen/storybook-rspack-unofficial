import type { StorybookConfig } from 'storybook-react-rspack';

const config: StorybookConfig = {
  framework: 'storybook-react-rspack',
  stories: ['../src/**/*.stories.@(ts|tsx|js|jsx)'],
};

export default config;
