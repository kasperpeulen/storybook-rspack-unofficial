import type { Meta, StoryObj } from '@storybook/react';
import { expect, mocked } from 'storybook/test';
import { getGreeting } from '../utils/greeting';

const GreetingComponent = ({ name }: { name: string }) => (
  <div>{getGreeting(name)}</div>
);

const meta = {
  title: 'Example/Greeting',
  component: GreetingComponent,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof GreetingComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { name: 'World' },
};

export const Mocked: Story = {
  args: { name: 'World' },
  beforeEach() {
    mocked(getGreeting).mockReturnValue('Mocked greeting!');
  },
  play: async () => {
    const result = getGreeting('World');
    await expect(result).toBe('Mocked greeting!');
  },
};
