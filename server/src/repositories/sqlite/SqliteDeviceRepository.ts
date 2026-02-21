/*
this repository reads and writes device rows in sqlite.
it is the only place in the codebase allowed to run device sql queries.
*/

import { DatabaseSync } from 'node:sqlite';
import { IDeviceRepository, DeviceListItem, DeviceListFilters } from '../IDeviceRepository';
import { Device, DeviceTelemetry } from '../../domain/Device';
import { DeviceStatus } from '../../domain/enums';
import { PaginatedResult } from '../../domain/Pagination';

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

// the shape of a summary row that includes the open incident count from a join
interface DeviceListRow {
  id: string;
  venue_id: string;
  label: string;
  status: string;
  last_heartbeat_at: number;
  open_incident_count: number;
}

// a count-only row for pagination totals
interface CountRow {
  total: number;
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

// maps a summary row to the DeviceListItem shape
function rowToListItem(row: DeviceListRow): DeviceListItem {
  return {
    id: row.id,
    venueId: row.venue_id,
    label: row.label,
    status: row.status as DeviceStatus,
    lastSeenAt: new Date(row.last_heartbeat_at * 1000),
    // coerce to number in case sqlite returns bigint for aggregate result
    openIncidentCount: Number(row.open_incident_count),
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

  // returns a paginated list of devices with their open incident counts.
  // null params use the "IS NULL OR ..." trick so one query covers all filter combos.
  listWithFilters(filters: DeviceListFilters): PaginatedResult<DeviceListItem> {
    const params = {
      status: filters.status ?? null,
      venueId: filters.venueId ?? null,
      limit: filters.limit,
      offset: filters.offset,
    };

    const rows = this.db.prepare(`
      SELECT
        d.id,
        d.venue_id,
        d.label,
        d.status,
        d.last_heartbeat_at,
        COALESCE(SUM(CASE WHEN i.status = 'OPEN' THEN 1 ELSE 0 END), 0) AS open_incident_count
      FROM devices d
      LEFT JOIN incidents i ON i.device_id = d.id
      WHERE (@status IS NULL OR d.status = @status)
        AND (@venueId IS NULL OR d.venue_id = @venueId)
      GROUP BY d.id
      ORDER BY d.updated_at DESC
      LIMIT @limit OFFSET @offset
    `).all(params) as unknown as DeviceListRow[];

    // separate count query so we can return total without loading all rows
    const countRow = this.db.prepare(`
      SELECT COUNT(*) AS total
      FROM devices d
      WHERE (@status IS NULL OR d.status = @status)
        AND (@venueId IS NULL OR d.venue_id = @venueId)
    `).get({ status: params.status, venueId: params.venueId }) as unknown as CountRow;

    return {
      items: rows.map(rowToListItem),
      total: Number(countRow.total),
      limit: filters.limit,
      offset: filters.offset,
    };
  }
}
