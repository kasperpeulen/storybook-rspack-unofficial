import React from 'react';

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
  const baseStyles: React.CSSProperties = {
    fontFamily: "'Nunito Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    fontWeight: 700,
    border: 0,
    borderRadius: '3em',
    cursor: 'pointer',
    display: 'inline-block',
    lineHeight: 1,
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    small: { fontSize: '12px', padding: '10px 16px' },
    medium: { fontSize: '14px', padding: '11px 20px' },
    large: { fontSize: '16px', padding: '12px 24px' },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: { color: 'white', backgroundColor: '#1ea7fd' },
    secondary: { color: '#333', backgroundColor: 'transparent', boxShadow: 'rgba(0,0,0,.15) 0 0 0 1px inset' },
  };

  return (
    <button
      type="button"
      style={{ ...baseStyles, ...sizeStyles[size], ...variantStyles[variant] }}
      onClick={onClick}
    >
      {label}
    </button>
  );
};
