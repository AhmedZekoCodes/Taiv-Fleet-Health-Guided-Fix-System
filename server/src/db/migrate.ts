/*
this module creates the database tables if they do not already exist.
run this once at startup before any repository is used.
*/

import { DatabaseSync } from 'node:sqlite';

// creates all three tables in a single transaction so schema is always consistent
export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS venues (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      address      TEXT NOT NULL DEFAULT '',
      city         TEXT NOT NULL DEFAULT '',
      state        TEXT NOT NULL DEFAULT '',
      contact_name TEXT NOT NULL DEFAULT '',
      contact_phone TEXT NOT NULL DEFAULT '',
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devices (
      id                       TEXT PRIMARY KEY,
      venue_id                 TEXT NOT NULL,
      label                    TEXT NOT NULL,
      status                   TEXT NOT NULL DEFAULT 'UNKNOWN',
      last_heartbeat_at        INTEGER NOT NULL,
      last_render_at           INTEGER,
      last_detection_at        INTEGER,
      signal_strength_percent  REAL,
      rssi_dbm                 REAL,
      firmware_version         TEXT,
      created_at               INTEGER NOT NULL,
      updated_at               INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id                    TEXT PRIMARY KEY,
      device_id             TEXT NOT NULL,
      venue_id              TEXT NOT NULL,
      type                  TEXT NOT NULL,
      severity              TEXT NOT NULL,
      status                TEXT NOT NULL DEFAULT 'OPEN',
      summary               TEXT NOT NULL,
      context               TEXT NOT NULL DEFAULT '{}',
      troubleshooting_steps TEXT NOT NULL DEFAULT '[]',
      detected_at           INTEGER NOT NULL,
      resolved_at           INTEGER,
      updated_at            INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_devices_venue_id
      ON devices(venue_id);

    CREATE INDEX IF NOT EXISTS idx_incidents_device_id
      ON incidents(device_id);

    CREATE INDEX IF NOT EXISTS idx_incidents_status
      ON incidents(status);
  `);
}
