import React from 'react';
import { DeviceListItem, DeviceStatus } from '../api/types';
import { StatusBadge } from './ui/StatusBadge';
import { StatusRail } from './ui/StatusRail';
import { SkeletonList } from './ui/SkeletonRow';
import { formatRelativeTime } from '../utils/time';
import { Density } from './Header';

// status filter options shown above the table
const STATUS_FILTERS: Array<{ label: string; value: DeviceStatus | '' }> = [
  { label: 'All', value: '' },
  { label: 'Online', value: 'ONLINE' },
  { label: 'Degraded', value: 'DEGRADED' },
  { label: 'Offline', value: 'OFFLINE' },
];

interface Props {
  items: DeviceListItem[];
  total: number;
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelectDevice: (id: string) => void;
  statusFilter: DeviceStatus | '';
  onStatusFilter: (status: DeviceStatus | '') => void;
  search: string;
  onSearch: (q: string) => void;
  density: Density;
}

export function DeviceListPanel({
  items,
  total,
  loading,
  error,
  selectedId,
  onSelectDevice,
  statusFilter,
  onStatusFilter,
  search,
  onSearch,
  density,
}: Props): React.ReactElement {
  return (
    <div className="flex flex-col h-full">
      {/* filter bar — sits above the scrollable table */}
      <div
        className="flex-shrink-0 px-4 pt-4 pb-3 space-y-2.5 border-b border-white/5"
        style={{ background: 'rgba(10, 4, 32, 0.5)' }}
      >
        {/* status filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => onStatusFilter(f.value as DeviceStatus | '')}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium border
                transition-colors duration-base ease-brand
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70
                ${
                  statusFilter === f.value
                    ? 'bg-brand-primary/80 border-brand-primary/50 text-white/95'
                    : 'glass border-white/8 text-white/45 hover:text-white/80 hover:bg-white/8'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* search input */}
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-white/25 text-sm select-none">
            ⌕
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search id, label, or venue…"
            className="w-full glass rounded-lg pl-7 pr-3 py-1.5 text-sm text-white/75 placeholder-white/22 bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60"
          />
        </div>

        {/* row count — meta info to help ops understand what they are seeing */}
        <p className="text-meta tabular-nums">
          {loading && items.length === 0
            ? 'Loading…'
            : `${items.length} of ${total} device${total !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* scrollable device table */}
      <div className="flex-1 overflow-y-auto">
        {/* sticky column headers */}
        <div
          className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 border-b border-white/5"
          style={{ background: 'rgba(10, 4, 32, 0.80)' }}
        >
          {/* spacer matching the width of the status rail */}
          <div className="w-0.5 flex-shrink-0" aria-hidden="true" />
          <span className="label-section w-24 flex-shrink-0">Venue</span>
          <span className="label-section flex-1 min-w-0">Device</span>
          <span className="label-section w-20 flex-shrink-0">Status</span>
          <span className="label-section w-16 flex-shrink-0 text-right">Last seen</span>
          <span className="label-section w-8 flex-shrink-0 text-right">Inc</span>
        </div>

        {/* error state */}
        {error && (
          <div className="px-6 py-10 text-center text-sm text-white/35">{error}</div>
        )}

        {/* skeleton loaders while the first fetch is in flight */}
        {loading && !error && <SkeletonList count={10} />}

        {/* empty state when filters return nothing */}
        {!loading && !error && items.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-white/28">No devices match the current filters.</p>
          </div>
        )}

        {/* device rows */}
        {!error &&
          items.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              selected={selectedId === device.id}
              onClick={() => onSelectDevice(device.id)}
              density={density}
            />
          ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// device row
// ----------------------------------------------------------------

interface RowProps {
  device: DeviceListItem;
  selected: boolean;
  onClick: () => void;
  density: Density;
}

function DeviceRow({ device, selected, onClick, density }: RowProps): React.ReactElement {
  // row vertical padding changes with density setting
  const py = density === 'compact' ? 'py-2' : 'py-3.5';

  // background varies between selected and default hover
  const bg = selected ? 'glass-selected' : 'hover:bg-white/[0.06]';

  // left border accent — selected state brightens the primary color strip
  const borderLeft = selected
    ? 'border-l-[3px] border-brand-primary/70'
    : 'border-l-[3px] border-transparent hover:border-brand-primary/30';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 text-left
        row-interactive border-b border-white/[0.04]
        focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-brand-primary/70
        ${py} ${bg} ${borderLeft}`}
    >
      {/* thin colored rail on the far left that encodes device health */}
      <StatusRail status={device.status} selected={selected} />

      {/* venue id */}
      <span
        className="w-24 flex-shrink-0 truncate text-meta"
        title={device.venueId}
      >
        {device.venueId}
      </span>

      {/* device label (primary) + id (de-emphasized) */}
      <span className="flex-1 min-w-0 flex flex-col gap-0">
        <span className="truncate text-sm font-medium text-white/88 leading-tight">
          {device.label}
        </span>
        <span className="truncate text-meta leading-tight">{device.id}</span>
      </span>

      {/* status badge */}
      <span className="w-20 flex-shrink-0">
        <StatusBadge status={device.status} />
      </span>

      {/* last seen — right-aligned, tabular */}
      <span className="w-16 flex-shrink-0 text-right text-meta tabular-nums">
        {formatRelativeTime(device.lastSeenAt)}
      </span>

      {/* open incident count — highlighted in primary color if > 0 */}
      <span
        className={`w-8 flex-shrink-0 text-right tabular-nums font-semibold ${
          device.openIncidentCount > 0 ? 'text-brand-primary text-sm' : 'text-meta text-xs'
        }`}
      >
        {device.openIncidentCount > 0 ? device.openIncidentCount : '—'}
      </span>
    </button>
  );
}
