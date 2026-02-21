import { DeviceStatus } from '../../api/types';

interface Props {
  status: DeviceStatus;
  // when the row is selected the rail gets a brighter accent
  selected?: boolean;
}

// the opacity of the rail encodes device health without introducing new colors.
// offline is loudest (high opacity), online is quietest (low opacity).
const STATUS_OPACITY: Record<DeviceStatus, number> = {
  OFFLINE: 0.9,
  DEGRADED: 0.5,
  ONLINE: 0.18,
  UNKNOWN: 0.08,
};

// a thin vertical line flush to the left edge of each device row
export function StatusRail({ status, selected = false }: Props): React.ReactElement {
  const opacity = selected ? Math.min(STATUS_OPACITY[status] * 1.8, 1) : STATUS_OPACITY[status];

  return (
    <div
      className="w-0.5 self-stretch flex-shrink-0 rounded-full transition-opacity duration-base ease-brand"
      style={{ backgroundColor: `rgba(112, 81, 245, ${opacity})` }}
    />
  );
}
