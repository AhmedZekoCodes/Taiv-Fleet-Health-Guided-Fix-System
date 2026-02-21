/*
these types describe the json shape the device endpoints return.
they are intentionally minimal — only the fields tests actually read are listed.
*/

// a single item in the GET /api/devices list response
export interface ResponseDeviceListItem {
  id: string;
  venueId: string;
  label: string;
  status: string;
  lastSeenAt: string;
  openIncidentCount: number;
}

// minimal incident shape used inside device detail
export interface ResponseIncidentSummary {
  id: string;
  type: string;
  status: string;
  severity: string;
  troubleshootingSteps: unknown[];
}

// the telemetry sub-object inside device detail
export interface ResponseTelemetry {
  lastHeartbeatAt: number;
  firmwareVersion: string | null;
}

// the device object inside GET /api/devices/:id
export interface ResponseDeviceFull {
  id: string;
  venueId: string;
  label: string;
  status: string;
  telemetry: ResponseTelemetry;
}

// the paginated wrapper used by the list endpoint
export interface ResponsePaginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// GET /api/devices list body
export type DeviceListResponseBody = ResponsePaginated<ResponseDeviceListItem>;

// GET /api/devices/:id body
export interface DeviceDetailResponseBody {
  device: ResponseDeviceFull;
  openIncidents: ResponseIncidentSummary[];
}
