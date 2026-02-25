/*
sqlite implementation of INotificationOutboxRepository.
all timestamps are stored as unix seconds (integer) and converted to/from Date on the boundary.
*/

import { randomUUID } from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { INotificationOutboxRepository } from '../INotificationOutboxRepository';
import {
  OutboxEntry,
  NewOutboxEntry,
  NotificationStatusSummary,
} from '../../domain/Notification';
import { NotificationChannel, NotificationStatus } from '../../domain/enums';
import { NOTIFICATION_MAX_ATTEMPTS } from '../../domain/constants';

// shape of one row as returned by sqlite.
// channel and status are typed as their enum equivalents because we fully control the schema
// and trust that only valid enum values are ever written to these columns.
interface OutboxRow {
  id: string;
  incident_id: string;
  venue_id: string;
  channel: NotificationChannel;
  to_address: string;
  subject: string | null;
  body: string;
  status: NotificationStatus;
  attempt_count: number;
  last_error: string | null;
  scheduled_at: number;
  sent_at: number | null;
  created_at: number;
  updated_at: number;
}

// shape returned by the count summary query
interface SummaryRow {
  status: string;
  cnt: number;
}

// maps a database row to the OutboxEntry domain model
function rowToEntry(row: OutboxRow): OutboxEntry {
  return {
    id: row.id,
    incidentId: row.incident_id,
    venueId: row.venue_id,
    channel: row.channel,
    toAddress: row.to_address,
    subject: row.subject,
    body: row.body,
    status: row.status,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    scheduledAt: new Date(row.scheduled_at * 1000),
    sentAt: row.sent_at ? new Date(row.sent_at * 1000) : null,
    createdAt: new Date(row.created_at * 1000),
    updatedAt: new Date(row.updated_at * 1000),
  };
}

export class SqliteNotificationOutboxRepository
  implements INotificationOutboxRepository
{
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  enqueue(entries: NewOutboxEntry[]): void {
    if (entries.length === 0) return;

    const now = Math.floor(Date.now() / 1000);

    const stmt = this.db.prepare(
      // insert or ignore enforces the unique(incident_id, channel, to_address) idempotency constraint
      `INSERT OR IGNORE INTO notification_outbox
         (id, incident_id, venue_id, channel, to_address, subject, body,
          status, attempt_count, scheduled_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?, ?)`,
    );

    for (const entry of entries) {
      stmt.run(
        randomUUID(),
        entry.incidentId,
        entry.venueId,
        entry.channel,
        entry.toAddress,
        entry.subject,
        entry.body,
        Math.floor(entry.scheduledAt.getTime() / 1000),
        now,
        now,
      );
    }
  }

  listPending(limit: number): OutboxEntry[] {
    const nowSeconds = Math.floor(Date.now() / 1000);

    // only fetch entries that are eligible: pending, scheduled, and have retries left
    const rows = this.db
      .prepare(
        `SELECT * FROM notification_outbox
         WHERE status = 'PENDING'
           AND scheduled_at <= ?
           AND attempt_count < ?
         ORDER BY scheduled_at ASC
         LIMIT ?`,
      )
      .all(nowSeconds, NOTIFICATION_MAX_ATTEMPTS, limit) as unknown as OutboxRow[];

    return rows.map(rowToEntry);
  }

  markSent(id: string, sentAt: Date): void {
    const now = Math.floor(Date.now() / 1000);
    const sentSeconds = Math.floor(sentAt.getTime() / 1000);

    this.db
      .prepare(
        `UPDATE notification_outbox
         SET status = 'SENT', sent_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(sentSeconds, now, id);
  }

  markFailed(id: string, error: string): void {
    const now = Math.floor(Date.now() / 1000);

    this.db
      .prepare(
        `UPDATE notification_outbox
         SET status = 'FAILED', last_error = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(error, now, id);
  }

  scheduleRetry(id: string, nextScheduledAt: Date, error: string): void {
    const now = Math.floor(Date.now() / 1000);
    const nextSeconds = Math.floor(nextScheduledAt.getTime() / 1000);

    this.db
      .prepare(
        `UPDATE notification_outbox
         SET attempt_count = attempt_count + 1,
             last_error    = ?,
             scheduled_at  = ?,
             updated_at    = ?
         WHERE id = ?`,
      )
      .run(error, nextSeconds, now, id);
  }

  summarizeByIncidentId(incidentId: string): NotificationStatusSummary {
    const rows = this.db
      .prepare(
        `SELECT status, COUNT(*) AS cnt
         FROM notification_outbox
         WHERE incident_id = ?
         GROUP BY status`,
      )
      .all(incidentId) as unknown as SummaryRow[];

    const summary: NotificationStatusSummary = {
      total: 0,
      sent: 0,
      pending: 0,
      failed: 0,
    };

    for (const row of rows) {
      summary.total += row.cnt;
      // compare against the string literal values to avoid unsafe enum comparison lint error
      if (row.status === 'SENT') summary.sent += row.cnt;
      if (row.status === 'PENDING') summary.pending += row.cnt;
      if (row.status === 'FAILED') summary.failed += row.cnt;
    }

    return summary;
  }
}
