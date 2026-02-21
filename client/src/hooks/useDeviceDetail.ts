import { useState, useCallback, useEffect } from 'react';
import { usePolling } from './usePolling';
import { getDevice } from '../api/devices';
import { DeviceDetail } from '../api/types';

const POLL_INTERVAL = 5000;

export interface DeviceDetailState {
  detail: DeviceDetail | null;
  loading: boolean;
  error: string | null;
}

// polls GET /api/devices/:id every 5 seconds while a device is selected.
// when deviceId is null the hook clears state and stops polling.
export function useDeviceDetail(deviceId: string | null): DeviceDetailState {
  const [detail, setDetail] = useState<DeviceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // clear stale data immediately when the selected device changes
  // this prevents flashing the previous device's data while the new one loads
  useEffect(() => {
    setDetail(null);
    setError(null);
    setLoading(deviceId !== null);
  }, [deviceId]);

    // skip polling when nothing is selected
      setDetail(null);
    // only show loading spinner on the very first load, not on background polls
    setLoading((prev) => (detail === null ? true : prev));

      setLoading(false);
      setError(null);
  const fetch = useCallback(async () => {
    if (!deviceId) {
      return;
    }

    try {
      const result = await getDevice(deviceId);
      setDetail(result);
      setLoading(false);
      setError(null);
    } catch {
      setLoading(false);
      setError('failed to load device detail');
    }
  }, [deviceId]);

  usePolling(fetch, POLL_INTERVAL);

  return { detail, loading, error };
}
