import React, { useState, useMemo } from 'react';
import { DeviceStatus } from '../api/types';
import { useDeviceList } from '../hooks/useDeviceList';
import { useDeviceDetail } from '../hooks/useDeviceDetail';
import { Header, Density } from '../components/Header';
import { DeviceListPanel } from '../components/DeviceListPanel';
import { DeviceDetailPanel } from '../components/DeviceDetailPanel';

// the main dashboard page — master-detail layout for the full device fleet
export function FleetPage(): React.ReactElement {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | ''>('');
  const [search, setSearch] = useState('');
  // density only affects row height — comfortable is the default
  const [density, setDensity] = useState<Density>('comfortable');

  // device list polls every 5s and applies the current filters
  const deviceList = useDeviceList({
    status: statusFilter || undefined,
    search,
  });

  // device detail polls every 5s only when a device is selected
  const deviceDetail = useDeviceDetail(selectedDeviceId);

  // total open incident count for the header — derived from the visible list items
  const openIncidentCount = useMemo(
    () => deviceList.items.reduce((sum, d) => sum + d.openIncidentCount, 0),
    [deviceList.items],
  );

  function handleSelectDevice(id: string): void {
    // clicking the same device again deselects it
    setSelectedDeviceId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex flex-col h-full">
      {/* sticky header with fleet stats + density toggle */}
      <Header
        totalDevices={deviceList.total}
        openIncidentCount={openIncidentCount}
        density={density}
        onDensityChange={setDensity}
      />

      {/* two-column master-detail layout */}
      <div className="flex flex-1 overflow-hidden lg:flex-row flex-col">
        {/* left column — scrollable device list */}
        <div
          className="lg:w-[42%] w-full flex-shrink-0 lg:border-r border-white/5 overflow-hidden flex flex-col"
          style={{ background: 'rgba(10, 4, 32, 0.35)' }}
        >
          <DeviceListPanel
            items={deviceList.items}
            total={deviceList.total}
            loading={deviceList.loading}
            error={deviceList.error}
            selectedId={selectedDeviceId}
            onSelectDevice={handleSelectDevice}
            statusFilter={statusFilter}
            onStatusFilter={setStatusFilter}
            search={search}
            onSearch={setSearch}
            density={density}
          />
        </div>

        {/* right column — device detail inspector */}
        <div className="flex-1 overflow-hidden">
          <DeviceDetailPanel
            deviceId={selectedDeviceId}
            detail={deviceDetail.detail}
            loading={deviceDetail.loading}
            error={deviceDetail.error}
          />
        </div>
      </div>
    </div>
  );
}
