import React from 'react';
import './Button.css';

export interface ButtonProps {
  /** Button label */
  label: string;
  /** Optional click handler */
  onClick?: () => void;
  /** Button variant */
  variant?: 'primary' | 'secondary';
  /** Button size */
  size?: 'small' | 'medium' | 'large';
}

export const Button = ({
  label,
  onClick,
  variant = 'primary',
  size = 'medium',
}: ButtonProps) => {
  const classNames = [
    'storybook-button',
    `storybook-button--${size}`,
    `storybook-button--${variant}`,
  ].join(' ');

  return (
    <button
      type="button"
      className={classNames}
      onClick={onClick}
    >
      {label}
    </button>
  );
};
