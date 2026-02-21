import { useState, useCallback } from 'react';
import { usePolling } from './usePolling';
import { listDevices } from '../api/devices';
import { DeviceListItem, DeviceStatus } from '../api/types';

// 5 seconds between polls, matching the POLLING_INTERVAL_MS constant in the backend
const POLL_INTERVAL = 5000;

export interface DeviceListFilters {
  status?: DeviceStatus;
  search: string;
}

export interface DeviceListState {
  // filtered and searched items ready to render
  items: DeviceListItem[];
  // total count from the api (before client-side search)
  total: number;
  loading: boolean;
  error: string | null;
}

export function useDeviceList(filters: DeviceListFilters): DeviceListState {
  const [allItems, setAllItems] = useState<DeviceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // fetch uses limit=100 to load the whole fleet in one request (ops tools have small fleets)
  const fetch = useCallback(async () => {
    try {
      const result = await listDevices({
        status: filters.status,
        limit: 100,
        offset: 0,
      });
      setAllItems(result.items);
      setTotal(result.total);
      // clear error and loading on first successful response
      setLoading(false);
      setError(null);
    } catch {
      setLoading(false);
      setError('failed to load devices');
    }
  }, [filters.status]);

  usePolling(fetch, POLL_INTERVAL);

  // apply client-side text search after the api returns results
  const items = filters.search.trim()
    ? allItems.filter((d) => {
        const q = filters.search.toLowerCase();
        return (
          d.id.toLowerCase().includes(q) ||
          d.label.toLowerCase().includes(q) ||
          d.venueId.toLowerCase().includes(q)
        );
      })
    : allItems;

  return { items, total, loading, error };
}
