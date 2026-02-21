/*
this repository reads and writes device rows in sqlite.
it is the only place in the codebase allowed to run device sql queries.
*/

import { DatabaseSync } from 'node:sqlite';
import { IDeviceRepository } from '../IDeviceRepository';
import { Device, DeviceTelemetry } from '../../domain/Device';
import { DeviceStatus } from '../../domain/enums';

// the shape of a raw row returned by node:sqlite for the devices table
interface DeviceRow {
  id: string;
  venue_id: string;
  label: string;
  status: string;
  last_heartbeat_at: number;
  last_render_at: number | null;
  last_detection_at: number | null;
  signal_strength_percent: number | null;
  rssi_dbm: number | null;
  firmware_version: string | null;
  created_at: number;
  updated_at: number;
}

// maps a raw sqlite row back to the domain Device type
function rowToDevice(row: DeviceRow): Device {
  const telemetry: DeviceTelemetry = {
    lastHeartbeatAt: row.last_heartbeat_at,
    lastRenderAt: row.last_render_at,
    lastDetectionAt: row.last_detection_at,
    signalStrengthPercent: row.signal_strength_percent,
    rssiDbm: row.rssi_dbm,
    firmwareVersion: row.firmware_version,
  };

  return {
    id: row.id,
    venueId: row.venue_id,
    label: row.label,
    status: row.status as DeviceStatus,
    telemetry,
    createdAt: new Date(row.created_at * 1000),
    updatedAt: new Date(row.updated_at * 1000),
  };
}

export class SqliteDeviceRepository implements IDeviceRepository {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  findById(id: string): Device | null {
    // node:sqlite returns Record<string, SQLOutputValue> so we cast through unknown
    const row = this.db
      .prepare('SELECT * FROM devices WHERE id = ?')
      .get(id) as unknown as DeviceRow | undefined;

    return row ? rowToDevice(row) : null;
  }

  // inserts the device if new, or updates all mutable fields on conflict
  upsert(device: Device): void {
    const t = device.telemetry;

    this.db.prepare(`
      INSERT INTO devices (
        id, venue_id, label, status,
        last_heartbeat_at, last_render_at, last_detection_at,
        signal_strength_percent, rssi_dbm, firmware_version,
        created_at, updated_at
      ) VALUES (
        @id, @venueId, @label, @status,
        @lastHeartbeatAt, @lastRenderAt, @lastDetectionAt,
        @signalStrengthPercent, @rssiDbm, @firmwareVersion,
        @createdAt, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        venue_id                = excluded.venue_id,
        label                   = excluded.label,
        status                  = excluded.status,
        last_heartbeat_at       = excluded.last_heartbeat_at,
        last_render_at          = excluded.last_render_at,
        last_detection_at       = excluded.last_detection_at,
        signal_strength_percent = excluded.signal_strength_percent,
        rssi_dbm                = excluded.rssi_dbm,
        firmware_version        = excluded.firmware_version,
        updated_at              = excluded.updated_at
    `).run({
      id: device.id,
      venueId: device.venueId,
      label: device.label,
      status: device.status,
      lastHeartbeatAt: t.lastHeartbeatAt,
      lastRenderAt: t.lastRenderAt,
      lastDetectionAt: t.lastDetectionAt,
      signalStrengthPercent: t.signalStrengthPercent,
      rssiDbm: t.rssiDbm,
      firmwareVersion: t.firmwareVersion,
      createdAt: Math.floor(device.createdAt.getTime() / 1000),
      updatedAt: Math.floor(device.updatedAt.getTime() / 1000),
    });
  }

  findAll(): Device[] {
    const rows = this.db
      .prepare('SELECT * FROM devices ORDER BY updated_at DESC')
      .all() as unknown as DeviceRow[];

    return rows.map(rowToDevice);
  }
}
