import { DeviceStatus } from '../../api/types';

interface Props {
  status: DeviceStatus;
}

// per-status visual config — opacity only, no new colors introduced
const STATUS_CONFIG: Record<
  DeviceStatus,
  { dotClass: string; textClass: string; label: string }
> = {
  ONLINE: {
    dotClass: 'opacity-100',
    textClass: 'opacity-100',
    label: 'Online',
  },
  DEGRADED: {
    dotClass: 'opacity-55',
    textClass: 'opacity-70',
    label: 'Degraded',
  },
  OFFLINE: {
    dotClass: 'opacity-20',
    textClass: 'opacity-40',
    label: 'Offline',
  },
  UNKNOWN: {
    dotClass: 'opacity-10',
    textClass: 'opacity-30',
    label: 'Unknown',
  },
};

// shows a colored dot + label pill that conveys device health at a glance
export function StatusBadge({ status }: Props): React.ReactElement {
  const cfg = STATUS_CONFIG[status];

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full glass px-2.5 py-0.5 text-xs font-medium text-white/90">
      {/* dot uses the primary brand color at varying opacity so no new color is added */}
      <span
        className={`h-1.5 w-1.5 rounded-full bg-brand-primary ${cfg.dotClass}`}
      />
      <span className={cfg.textClass}>{cfg.label}</span>
    </span>
  );
}
