import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
  title: 'Example/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: { control: 'radio', options: ['primary', 'secondary'] },
    size: { control: 'radio', options: ['small', 'medium', 'large'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: 'Button',
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    label: 'Button',
    variant: 'secondary',
  },
};

export const Large: Story = {
  args: {
    label: 'Large Button33334445555',
    size: 'large',
  },
};

export const Small: Story = {
  args: {
    label: 'Small Button',
    size: 'small',
  },
};
