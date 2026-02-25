/*
this contract defines all persistence operations for the notification outbox.
the worker and the notification service both depend on this interface, not on sqlite directly.
*/

import { OutboxEntry, NewOutboxEntry, NotificationStatusSummary } from '../domain/Notification';

export interface INotificationOutboxRepository {
  // inserts new outbox entries. skips duplicates silently (insert or ignore).
  enqueue(entries: NewOutboxEntry[]): void;

  // returns up to `limit` pending entries whose scheduled_at <= now, ordered oldest first.
  // only returns entries with attempt_count < max_attempts.
  listPending(limit: number): OutboxEntry[];

  // marks an entry as successfully sent
  markSent(id: string, sentAt: Date): void;

  // marks an entry as permanently failed after all retries are exhausted
  markFailed(id: string, error: string): void;

  // increments attempt_count and sets scheduled_at to the next retry time.
  // used when a send attempt fails but retries remain.
  scheduleRetry(id: string, nextScheduledAt: Date, error: string): void;

  // returns a compact status summary for all outbox entries tied to one incident.
  // used by the api to show "venue notified" status on incident cards.
  summarizeByIncidentId(incidentId: string): NotificationStatusSummary;
}
