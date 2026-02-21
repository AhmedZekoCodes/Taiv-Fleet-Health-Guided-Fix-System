/*
these types describe the shape of the json body the heartbeat endpoint returns.
they are minimal on purpose — only fields that tests or clients actually read are listed.
*/

// the telemetry sub-object returned inside the device
export interface ResponseTelemetry {
  firmwareVersion: string | null;
}

// the device portion of the heartbeat response
export interface ResponseDevice {
  id: string;
  venueId: string;
  label: string;
  status: string;
  telemetry: ResponseTelemetry;
}

// a single incident as it appears in the heartbeat response
export interface ResponseIncident {
  type: string;
  status: string;
  resolvedAt: string | null;
  troubleshootingSteps: unknown[];
}

// the full json body for a successful 200 heartbeat response
export interface HeartbeatSuccessBody {
  device: ResponseDevice;
  newIncidents: ResponseIncident[];
  resolvedIncidents: ResponseIncident[];
}

// the json body returned on a 400 validation error
export interface HeartbeatErrorBody {
  error: string;
}
