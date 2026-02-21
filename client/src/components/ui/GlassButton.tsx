import React from 'react';

interface Props {
  children: React.ReactNode;
  onClick?: () => void;
  // primary — solid brand purple; subtle — transparent glass
  variant?: 'primary' | 'subtle';
  className?: string;
  disabled?: boolean;
// reusable button component with glass styling
  title?: string;
}

export function GlassButton({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled = false,
  title,
}: Props): React.ReactElement {
  const base =
    'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium cursor-pointer ' +
    'transition-[background-color,transform,opacity] duration-base ease-brand ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/80 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]';

  const styles =
    variant === 'primary'
      ? 'bg-brand-primary/90 text-white/95 hover:bg-brand-primary border border-brand-primary/50'
      : 'glass text-white/60 hover:text-white/90 hover:bg-white/10 border-transparent';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
