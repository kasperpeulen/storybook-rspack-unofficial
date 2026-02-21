import React from 'react';

export interface BadgeProps {
  label: string;
  color?: 'green' | 'red' | 'blue';
}

export const Badge = ({ label, color = 'blue' }: BadgeProps) => {
  const colors = {
    green: { bg: '#e6f4ea', text: '#1e7e34' },
    red: { bg: '#fce8e6', text: '#c5221f' },
    blue: { bg: '#e8f0fe', text: '#1a73e8' },
  };

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
        backgroundColor: colors[color].bg,
        color: colors[color].text,
      }}
    >
      {label}
    </span>
  );
};
