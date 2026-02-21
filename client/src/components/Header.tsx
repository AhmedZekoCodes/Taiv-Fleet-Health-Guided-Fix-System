import React from 'react';

export type Density = 'comfortable' | 'compact';

interface Props {
  totalDevices: number;
  openIncidentCount: number;
  density: Density;
  onDensityChange: (d: Density) => void;
}

// sticky top bar with the app identity, fleet stats, and the density toggle
export function Header({
  totalDevices,
  openIncidentCount,
  density,
  onDensityChange,
}: Props): React.ReactElement {
  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 flex-shrink-0 backdrop-blur-md border-b border-white/[0.07]"
      style={{ background: 'rgba(20, 12, 50, 0.88)' }}
    >
      {/* brand mark + app title */}
        {/* taiv logo mark — a small purple square with a rounded corner */}
      <div className="flex items-center gap-3">
        <div
          className="h-7 w-7 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: 'rgba(112, 81, 245, 0.9)' }}
          aria-hidden="true"
        >
          T
        </div>
        <div>
          <p className="text-sm font-semibold text-white/95 leading-tight">Fleet Health</p>
          <p className="label-section">Taiv Ops Console</p>
        </div>
      </div>

      {/* right side: stats + density toggle */}
      <div className="flex items-center gap-6">
        {/* fleet-level stats */}
        <Stat label="Devices" value={String(totalDevices)} />
        <Stat
          label="Open Incidents"
          value={String(openIncidentCount)}
          highlight={openIncidentCount > 0}
        />

        {/* density toggle — comfortable / compact row height */}
        <div
          className="flex items-center gap-0.5 glass rounded-lg p-0.5"
          role="group"
          aria-label="Row density"
        >
          {(['comfortable', 'compact'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDensityChange(d)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide
                transition-colors duration-base ease-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70
                ${density === d ? 'bg-brand-primary/80 text-white/95' : 'text-white/35 hover:text-white/65'}`}
            >
              {d === 'comfortable' ? 'Cozy' : 'Dense'}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

// a single key-value stat shown in the header bar
function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}): React.ReactElement {
  return (
    <div className="text-right hidden sm:block">
      <div
        className={`text-lg font-semibold leading-tight tabular-nums transition-colors duration-base ${
          highlight ? 'text-brand-primary' : 'text-white/85'
        }`}
      >
        {value}
      </div>
      <div className="label-section">{label}</div>
    </div>
  );
}
