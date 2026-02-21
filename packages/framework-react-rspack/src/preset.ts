import type { PresetProperty } from 'storybook/internal/types';

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: 'storybook-builder-rspack',
      options: (typeof framework === 'object' ? framework?.options?.builder : {}) || {},
    },
    renderer: '@storybook/react',
  };
};
