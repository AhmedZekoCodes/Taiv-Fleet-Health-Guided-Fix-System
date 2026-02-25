/*
this module creates all database tables if they do not already exist.
run this once at startup before any repository is used.
*/

import { DatabaseSync } from 'node:sqlite';

// wraps all DDL in a single transaction so a crash mid-migration
// leaves the schema either fully applied or fully absent, never partial.
export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    BEGIN IMMEDIATE;
  `);

  try {
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

    -- venue_contacts holds who should be notified when an incident occurs at a venue.
    -- channels stores a comma-separated list: 'EMAIL', 'SMS', or 'EMAIL,SMS'.
    CREATE TABLE IF NOT EXISTS venue_contacts (
      id         TEXT PRIMARY KEY,
      venue_id   TEXT NOT NULL,
      name       TEXT NOT NULL,
      email      TEXT,
      phone      TEXT,
      channels   TEXT NOT NULL DEFAULT 'EMAIL',
      is_active  INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_venue_contacts_venue_id
      ON venue_contacts(venue_id);

    -- notification_outbox is the reliable delivery queue.
    -- one row per (incident, channel, recipient) combination.
    -- the unique constraint is the idempotency key: no duplicate sends for the same target.
    CREATE TABLE IF NOT EXISTS notification_outbox (
      id            TEXT PRIMARY KEY,
      incident_id   TEXT NOT NULL,
      venue_id      TEXT NOT NULL,
      channel       TEXT NOT NULL,
      to_address    TEXT NOT NULL,
      subject       TEXT,
      body          TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'PENDING',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error    TEXT,
      scheduled_at  INTEGER NOT NULL,
      sent_at       INTEGER,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL,
      UNIQUE(incident_id, channel, to_address)
    );

    CREATE INDEX IF NOT EXISTS idx_outbox_status_scheduled
      ON notification_outbox(status, scheduled_at);

    CREATE INDEX IF NOT EXISTS idx_outbox_incident_id
      ON notification_outbox(incident_id);
    `);
    db.exec('COMMIT;');
  } catch (err: unknown) {
    // roll back so the next startup attempt can retry cleanly
    db.exec('ROLLBACK;');
    throw err;
  }
}
