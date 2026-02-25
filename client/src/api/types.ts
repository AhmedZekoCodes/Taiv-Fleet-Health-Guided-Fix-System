/*
these types mirror exactly what the backend api returns in json.
date fields that are Date objects on the server become iso strings after json serialization.
*/

// ------------------------------------------------------------------
// shared
// ------------------------------------------------------------------

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ------------------------------------------------------------------
// device
// ------------------------------------------------------------------

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN';

export interface DeviceTelemetry {
  // unix timestamp in seconds — stored as an integer, not a date string
  lastHeartbeatAt: number;
  lastRenderAt: number | null;
  lastDetectionAt: number | null;
  signalStrengthPercent: number | null;
  rssiDbm: number | null;
  firmwareVersion: string | null;
}

export interface Device {
  id: string;
  venueId: string;
  label: string;
  status: DeviceStatus;
  telemetry: DeviceTelemetry;
  createdAt: string;
  updatedAt: string;
}

// the trimmed-down view returned by GET /api/devices (list endpoint)
export interface DeviceListItem {
  id: string;
  venueId: string;
  label: string;
  status: DeviceStatus;
  // iso date string derived from telemetry.lastHeartbeatAt
  lastSeenAt: string;
  openIncidentCount: number;
}

// the detail response from GET /api/devices/:id
export interface DeviceDetail {
  device: Device;
  openIncidents: Incident[];
}

// ------------------------------------------------------------------
// incident
// ------------------------------------------------------------------

export type IncidentType =
  | 'OFFLINE'
  | 'NO_RENDER'
  | 'DETECTION_STALE'
  | 'WEAK_NETWORK';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'RESOLVED' | 'ACKNOWLEDGED';

export interface TroubleshootingStep {
  order: number;
  title: string;
  description: string;
  requiresConfirmation: boolean;
}

// compact summary of outbox delivery state for one incident
export interface NotificationStatusSummary {
  total: number;
  sent: number;
  pending: number;
  failed: number;
}

export interface Incident {
  id: string;
  deviceId: string;
  venueId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  summary: string;
  context: Record<string, unknown>;
  troubleshootingSteps: TroubleshootingStep[];
  detectedAt: string;
  resolvedAt: string | null;
  updatedAt: string;
  // present when the backend has notification tracking wired up
  notificationStatus?: NotificationStatusSummary;
}
