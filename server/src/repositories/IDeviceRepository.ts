/*
this is the contract every device repository must follow.
services depend on this interface, not on sqlite directly (dependency inversion).
*/

import { Device } from '../domain/Device';
import { DeviceStatus } from '../domain/enums';
import { PaginatedResult } from '../domain/Pagination';

// the trimmed-down view used in list responses — full telemetry is omitted to keep payloads small
export interface DeviceListItem {
  id: string;
  venueId: string;
  label: string;
  status: DeviceStatus;
  // the last time the device sent any data to the server
  lastSeenAt: Date;
  // how many incidents are currently open for this device
  openIncidentCount: number;
}

// supported filters for the device list query
export interface DeviceListFilters {
  status?: DeviceStatus;
  venueId?: string;
  limit: number;
  offset: number;
}

export interface IDeviceRepository {
  // finds a device by its unique id, returns null if it does not exist
  findById(id: string): Device | null;
  // inserts a new device or updates all mutable fields if the id already exists
  upsert(device: Device): void;
  // returns every device in the fleet — used internally, not for pagination
  findAll(): Device[];
  // returns a paginated, filtered list with open incident counts
  listWithFilters(filters: DeviceListFilters): PaginatedResult<DeviceListItem>;
}
