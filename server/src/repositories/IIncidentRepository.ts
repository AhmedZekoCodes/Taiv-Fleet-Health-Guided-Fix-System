/*
this is the contract every incident repository must follow.
the heartbeat service only talks to this interface, never to sqlite directly.
*/

import { Incident } from '../domain/Incident';
import { IncidentType } from '../domain/enums';
import { PaginatedResult } from '../domain/Pagination';

// supported filters for the incident list query
export interface IncidentListFilters {
  // when true, only open incidents are returned
  onlyActive: boolean;
  // optionally restrict to a single device
  deviceId?: string;
  limit: number;
  offset: number;
}

export interface IIncidentRepository {
  // returns all open incidents for a given device
  findOpenByDeviceId(deviceId: string): Incident[];
  // returns the single open incident of a specific type for a device, or null
  findOpenByDeviceIdAndType(deviceId: string, type: IncidentType): Incident | null;
  // returns a single incident by id, or null if it does not exist
  findById(id: string): Incident | null;
  // persists a new incident record
  create(incident: Incident): void;
  // marks an incident as resolved and records when it was resolved
  resolve(id: string, resolvedAt: Date): void;
  // bumps the updated_at timestamp to show the incident is still active
  updateTimestamp(id: string, updatedAt: Date): void;
  // returns a paginated list of incidents with optional active/device filters
  listWithFilters(filters: IncidentListFilters): PaginatedResult<Incident>;
}
