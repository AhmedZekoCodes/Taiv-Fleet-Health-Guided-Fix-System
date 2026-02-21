/*
this is the contract every incident repository must follow.
the heartbeat service only talks to this interface, never to sqlite directly.
*/

import { Incident } from '../domain/Incident';
import { IncidentType } from '../domain/enums';

export interface IIncidentRepository {
  // returns all open incidents for a given device
  findOpenByDeviceId(deviceId: string): Incident[];
  // returns the single open incident of a specific type for a device, or null
  findOpenByDeviceIdAndType(deviceId: string, type: IncidentType): Incident | null;
  // persists a new incident record
  create(incident: Incident): void;
  // marks an incident as resolved and records when it was resolved
  resolve(id: string, resolvedAt: Date): void;
  // bumps the updated_at timestamp to show the incident is still active
  updateTimestamp(id: string, updatedAt: Date): void;
}
