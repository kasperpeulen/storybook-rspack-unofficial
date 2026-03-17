import { describe, expect, it } from 'vitest';
import type { Configuration } from '@rspack/core';
import { rspackFinal } from './preset';

const mockOptions = (reactDocgen: string | false | undefined) => ({
  presets: {
    apply: async (name: string) => {
      if (name === 'typescript') {
        return { reactDocgen };
      }
      return undefined;
    },
  },
});

describe('rspackFinal', () => {
  it('react-docgen: adds one rule with react-docgen-loader', async () => {
    const config: Configuration = {};
    const result = await rspackFinal(config, mockOptions('react-docgen'));

    const rules = result.module?.rules ?? [];
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      test: /\.(cjs|mjs|tsx?|jsx?)$/,
      enforce: 'pre',
    });
    expect((rules[0] as any).loader).toContain('react-docgen-loader');
  });

  it('react-docgen-typescript: adds two rules (JS docgen + TS docgen-typescript)', async () => {
    const config: Configuration = {};
    const result = await rspackFinal(config, mockOptions('react-docgen-typescript'));

    const rules = result.module?.rules ?? [];
    expect(rules).toHaveLength(2);

    // First rule: react-docgen-loader for JS/JSX
    expect(rules[0]).toMatchObject({
      test: /\.(cjs|mjs|jsx?)$/,
      enforce: 'pre',
    });
    expect((rules[0] as any).loader).toContain('react-docgen-loader');

    // Second rule: react-docgen-typescript-loader for TS/TSX
    expect(rules[1]).toMatchObject({
      test: /\.tsx?$/,
      enforce: 'pre',
    });
    expect((rules[1] as any).loader).toContain('react-docgen-typescript-loader');
  });

  it('reactDocgen: false returns config unchanged', async () => {
    const config: Configuration = { module: { rules: [{ test: /\.js$/ }] } };
    const result = await rspackFinal(config, mockOptions(false));

    expect(result).toBe(config);
  });

  it('reactDocgen: undefined defaults to react-docgen and adds loader', async () => {
    const config: Configuration = {};
    const result = await rspackFinal(config, mockOptions(undefined));

    const rules = result.module?.rules ?? [];
    expect(rules).toHaveLength(1);
    expect((rules[0] as any).loader).toContain('react-docgen-loader');
  });
});
