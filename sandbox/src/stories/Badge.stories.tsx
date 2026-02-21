import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '@components/Badge';

const meta = {
  title: 'Example/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Blue: Story = {
  args: { label: 'Info', color: 'blue' },
};

export const Green: Story = {
  args: { label: 'Success', color: 'green' },
};

export const Red: Story = {
  args: { label: 'Error', color: 'red' },
};
