/*
typed functions for the incident endpoints.
*/

import { apiGet } from './client';
import { Incident, PaginatedResult } from './types';

export interface IncidentListParams {
  active?: boolean;
  deviceId?: string;
  limit?: number;
  offset?: number;
}

// returns a paginated list of incidents with optional filters
export async function listIncidents(
  params: IncidentListParams = {},
): Promise<PaginatedResult<Incident>> {
  const qs = new URLSearchParams();

  // the backend expects the string 'true' or 'false', default is 'true' (active only)
  if (params.active !== undefined) qs.set('active', String(params.active));
  if (params.deviceId) qs.set('deviceId', params.deviceId);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));

  const query = qs.toString();
  const path = query ? `/api/incidents?${query}` : '/api/incidents';

  return apiGet<PaginatedResult<Incident>>(path);
}
