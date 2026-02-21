/*
this repository reads and writes incident rows in sqlite.
context and troubleshooting steps are stored as json strings and parsed on read.
*/

import { DatabaseSync } from 'node:sqlite';
import { IIncidentRepository, IncidentListFilters } from '../IIncidentRepository';
import { Incident, TroubleshootingStep } from '../../domain/Incident';
import { IncidentType, SeverityLevel, IncidentStatus } from '../../domain/enums';
import { PaginatedResult } from '../../domain/Pagination';

// the shape of a raw row returned by node:sqlite for the incidents table
interface IncidentRow {
  id: string;
  device_id: string;
  venue_id: string;
  type: string;
  severity: string;
  status: string;
  summary: string;
  context: string;
  troubleshooting_steps: string;
  detected_at: number;
  resolved_at: number | null;
  updated_at: number;
}

// a count-only row for pagination totals
interface CountRow {
  total: number;
}

// maps a raw sqlite row back to the domain Incident type
function rowToIncident(row: IncidentRow): Incident {
  return {
    id: row.id,
    deviceId: row.device_id,
    venueId: row.venue_id,
    type: row.type as IncidentType,
    severity: row.severity as SeverityLevel,
    status: row.status as IncidentStatus,
    summary: row.summary,
    context: JSON.parse(row.context) as Record<string, unknown>,
    troubleshootingSteps: JSON.parse(row.troubleshooting_steps) as TroubleshootingStep[],
    detectedAt: new Date(row.detected_at * 1000),
    resolvedAt: row.resolved_at !== null ? new Date(row.resolved_at * 1000) : null,
    updatedAt: new Date(row.updated_at * 1000),
  };
}

export class SqliteIncidentRepository implements IIncidentRepository {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  findOpenByDeviceId(deviceId: string): Incident[] {
    // node:sqlite returns Record<string, SQLOutputValue> so we cast through unknown
    const rows = this.db
      .prepare(`SELECT * FROM incidents WHERE device_id = ? AND status = 'OPEN' ORDER BY detected_at DESC`)
      .all(deviceId) as unknown as IncidentRow[];

    return rows.map(rowToIncident);
  }

  findOpenByDeviceIdAndType(deviceId: string, type: IncidentType): Incident | null {
    const row = this.db
      .prepare(`SELECT * FROM incidents WHERE device_id = ? AND type = ? AND status = 'OPEN' LIMIT 1`)
      .get(deviceId, type) as unknown as IncidentRow | undefined;

    return row ? rowToIncident(row) : null;
  }

  findById(id: string): Incident | null {
    const row = this.db
      .prepare('SELECT * FROM incidents WHERE id = ?')
      .get(id) as unknown as IncidentRow | undefined;

    return row ? rowToIncident(row) : null;
  }

  create(incident: Incident): void {
    this.db.prepare(`
      INSERT INTO incidents (
        id, device_id, venue_id, type, severity, status,
        summary, context, troubleshooting_steps,
        detected_at, resolved_at, updated_at
      ) VALUES (
        @id, @deviceId, @venueId, @type, @severity, @status,
        @summary, @context, @troubleshootingSteps,
        @detectedAt, @resolvedAt, @updatedAt
      )
    `).run({
      id: incident.id,
      deviceId: incident.deviceId,
      venueId: incident.venueId,
      type: incident.type,
      severity: incident.severity,
      status: incident.status,
      summary: incident.summary,
      context: JSON.stringify(incident.context),
      troubleshootingSteps: JSON.stringify(incident.troubleshootingSteps),
      detectedAt: Math.floor(incident.detectedAt.getTime() / 1000),
      resolvedAt: incident.resolvedAt
        ? Math.floor(incident.resolvedAt.getTime() / 1000)
        : null,
      updatedAt: Math.floor(incident.updatedAt.getTime() / 1000),
    });
  }

  resolve(id: string, resolvedAt: Date): void {
    const resolvedAtSeconds = Math.floor(resolvedAt.getTime() / 1000);
    this.db.prepare(`
      UPDATE incidents
      SET status = 'RESOLVED', resolved_at = ?, updated_at = ?
      WHERE id = ?
    `).run(resolvedAtSeconds, resolvedAtSeconds, id);
  }

  updateTimestamp(id: string, updatedAt: Date): void {
    this.db
      .prepare('UPDATE incidents SET updated_at = ? WHERE id = ?')
      .run(Math.floor(updatedAt.getTime() / 1000), id);
  }

  // returns a paginated, optionally filtered list of incidents.
  // when onlyActive is true only open incidents are returned.
  listWithFilters(filters: IncidentListFilters): PaginatedResult<Incident> {
    // pass a string or null so the IS NULL trick works in sql
    const statusFilter = filters.onlyActive ? 'OPEN' : null;
    const deviceId = filters.deviceId ?? null;

    const params = {
      statusFilter,
      deviceId,
      limit: filters.limit,
      offset: filters.offset,
    };

    const rows = this.db.prepare(`
      SELECT * FROM incidents
      WHERE (@statusFilter IS NULL OR status = @statusFilter)
        AND (@deviceId IS NULL OR device_id = @deviceId)
      ORDER BY detected_at DESC
      LIMIT @limit OFFSET @offset
    `).all(params) as unknown as IncidentRow[];

    const countRow = this.db.prepare(`
      SELECT COUNT(*) AS total FROM incidents
      WHERE (@statusFilter IS NULL OR status = @statusFilter)
        AND (@deviceId IS NULL OR device_id = @deviceId)
    `).get({ statusFilter, deviceId }) as unknown as CountRow;

    return {
      items: rows.map(rowToIncident),
      total: Number(countRow.total),
      limit: filters.limit,
      offset: filters.offset,
    };
  }
}
