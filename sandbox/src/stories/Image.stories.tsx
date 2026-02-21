import type { Meta, StoryObj } from '@storybook/react';
import reactLogo from './react-logo.png';

const ImageComponent = ({ src, alt }: { src: string; alt: string }) => (
  <div>
    <img src={src} alt={alt} style={{ maxWidth: 200 }} />
    <p>{alt}</p>
  </div>
);

const meta = {
  title: 'Example/Image',
  component: ImageComponent,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ImageComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReactLogo: Story = {
  args: {
    src: reactLogo,
    alt: 'React Logo',
  },
};
