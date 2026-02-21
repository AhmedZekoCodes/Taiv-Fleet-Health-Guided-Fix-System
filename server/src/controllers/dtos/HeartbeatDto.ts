/*
this defines what a device is allowed to send in a heartbeat request.
zod validates the shape and types before the service ever sees the data.
*/

import { z } from 'zod';

export const HeartbeatDtoSchema = z.object({
  // unique identifier for the taiv box sending this heartbeat
  deviceId: z.string().min(1, 'deviceId is required'),
  // which venue this device belongs to
  venueId: z.string().min(1, 'venueId is required'),
  // human-readable label for the box (e.g. "Bar TV 3")
  label: z.string().min(1, 'label is required'),
  // unix seconds of the last time this device rendered content — null if never
  lastRenderAt: z.number().int().positive().nullable().optional(),
  // unix seconds of the last commercial break detection — null if never
  lastDetectionAt: z.number().int().positive().nullable().optional(),
  // wifi signal strength 0–100 percent — null if not available
  signalStrengthPercent: z.number().min(0).max(100).nullable().optional(),
  // raw rssi in dbm (negative) — null if not available
  rssiDbm: z.number().nullable().optional(),
  // firmware version string reported by the box — null if not available
  firmwareVersion: z.string().nullable().optional(),
});

export type HeartbeatDto = z.infer<typeof HeartbeatDtoSchema>;
