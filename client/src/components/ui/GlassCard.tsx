import React from 'react';

// three visual layers for the glass surface system:
// default — standard frosted panel
// inset   — darker inner area for secondary content
// elevated — brightest layer with shadow + inner top highlight (main cards)
export type GlassVariant = 'default' | 'inset' | 'elevated';

interface Props {
  children: React.ReactNode;
  variant?: GlassVariant;
  className?: string;
  style?: React.CSSProperties;
}

const VARIANT_CLASS: Record<GlassVariant, string> = {
  default: 'glass',
  inset: 'glass-inset',
  elevated: 'glass-elevated',
};

export function GlassCard({
  children,
  variant = 'default',
  className = '',
  style,
}: Props): React.ReactElement {
  return (
    <div className={`${VARIANT_CLASS[variant]} rounded-xl ${className}`} style={style}>
      {children}
    </div>
  );
}
