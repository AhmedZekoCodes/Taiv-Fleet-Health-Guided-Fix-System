/*
this represents a single taiv tv box deployed at a venue.
it holds the latest snapshot of what that device reported back.
*/

import { DeviceStatus } from './enums';

// the telemetry snapshot sent by a device on each heartbeat
export interface DeviceTelemetry {
  // unix timestamp (seconds) of when the device last sent a heartbeat
  lastHeartbeatAt: number;
  // unix timestamp (seconds) of the last time an ad or content was rendered
  lastRenderAt: number | null;
  // unix timestamp (seconds) of the last time the device detected a commercial break
  lastDetectionAt: number | null;
  // wifi signal strength as a percentage (0–100)
  signalStrengthPercent: number | null;
  // raw rssi value in dBm (negative number, closer to 0 is stronger)
  rssiDbm: number | null;
  // firmware version string reported by the box
  firmwareVersion: string | null;
}

// the full device record stored in the system
export interface Device {
  id: string;
  venueId: string;
  // human-readable label so ops staff know which tv it is
  label: string;
  status: DeviceStatus;
  telemetry: DeviceTelemetry;
  createdAt: Date;
  updatedAt: Date;
}
