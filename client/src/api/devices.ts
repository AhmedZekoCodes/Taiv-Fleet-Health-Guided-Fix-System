/*
typed functions for the device endpoints.
callers receive strongly-typed results and never touch fetch directly.
*/

import { apiGet } from './client';
import { DeviceListItem, DeviceDetail, PaginatedResult, DeviceStatus } from './types';

export interface DeviceListParams {
  status?: DeviceStatus;
  venueId?: string;
  limit?: number;
  offset?: number;
}

// returns a paginated list of devices with optional filters
export async function listDevices(
  params: DeviceListParams = {},
): Promise<PaginatedResult<DeviceListItem>> {
  const qs = new URLSearchParams();

  if (params.status) qs.set('status', params.status);
  if (params.venueId) qs.set('venueId', params.venueId);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));

  const query = qs.toString();
  const path = query ? `/api/devices?${query}` : '/api/devices';

  return apiGet<PaginatedResult<DeviceListItem>>(path);
}

// returns a single device with its open incidents
export async function getDevice(id: string): Promise<DeviceDetail> {
  return apiGet<DeviceDetail>(`/api/devices/${encodeURIComponent(id)}`);
}
