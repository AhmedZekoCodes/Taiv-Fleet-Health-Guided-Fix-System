/*
the worker drains the notification outbox.
it polls for pending entries, sends each via the correct sender strategy,
and marks them sent or schedules a retry with exponential backoff.
*/

import { INotificationOutboxRepository } from '../repositories/INotificationOutboxRepository';
import { INotificationSender } from './INotificationSender';
import { OutboxEntry } from '../domain/Notification';
import { NotificationChannel } from '../domain/enums';
import {
  NOTIFICATION_WORKER_POLL_MS,
  NOTIFICATION_WORKER_BATCH_SIZE,
  NOTIFICATION_MAX_ATTEMPTS,
  NOTIFICATION_RETRY_BACKOFF_SECONDS,
} from '../domain/constants';

export class NotificationWorker {
  private readonly outboxRepo: INotificationOutboxRepository;
  // strategy map: channel -> concrete sender implementation
  private readonly senders: Map<NotificationChannel, INotificationSender>;
  private timer: NodeJS.Timeout | null = null;
  // prevents a second poll from starting while the previous one is still awaiting senders
  private isRunning = false;

  constructor(
    outboxRepo: INotificationOutboxRepository,
    senders: INotificationSender[],
  ) {
    this.outboxRepo = outboxRepo;
    this.senders = new Map(senders.map((s) => [s.channel, s]));
  }

  // starts the background polling loop
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      // skip this tick if the previous run is still in progress.
      // this prevents two concurrent runs from fetching the same pending rows
      // and dispatching the same notification twice when a real async sender is slow.
      if (this.isRunning) return;

      this.isRunning = true;
      this.runOnce()
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[notification-worker] unexpected error: ${msg}`);
        })
        .finally(() => {
          this.isRunning = false;
        });
    }, NOTIFICATION_WORKER_POLL_MS);
    console.log(`[notification-worker] started — polling every ${NOTIFICATION_WORKER_POLL_MS}ms`);
  }

  // stops the polling loop — call on graceful shutdown
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // processes one batch of pending outbox entries.
  // exposed publicly so tests can drive the worker synchronously.
  async runOnce(): Promise<void> {
    const pending = this.outboxRepo.listPending(NOTIFICATION_WORKER_BATCH_SIZE);

    for (const entry of pending) {
      await this.processEntry(entry);
    }
  }

  // sends one entry and records the outcome
  private async processEntry(entry: OutboxEntry): Promise<void> {
    const sender = this.senders.get(entry.channel);

    if (!sender) {
      // no sender registered for this channel — treat as permanent failure
      this.outboxRepo.markFailed(entry.id, `no sender registered for channel ${entry.channel}`);
      return;
    }

    try {
      await sender.send(entry);
      this.outboxRepo.markSent(entry.id, new Date());
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const nextAttemptIndex = entry.attemptCount + 1;

      if (nextAttemptIndex >= NOTIFICATION_MAX_ATTEMPTS) {
        // all retries exhausted — mark permanently failed
        this.outboxRepo.markFailed(entry.id, errorMsg);
        console.warn(
          `[notification-worker] failed permanently: id=${entry.id} error=${errorMsg}`,
        );
      } else {
        // schedule a retry with backoff delay
        const backoffSeconds =
          NOTIFICATION_RETRY_BACKOFF_SECONDS[nextAttemptIndex] ??
          NOTIFICATION_RETRY_BACKOFF_SECONDS[NOTIFICATION_RETRY_BACKOFF_SECONDS.length - 1];

        const nextScheduledAt = new Date(Date.now() + backoffSeconds * 1000);
        this.outboxRepo.scheduleRetry(entry.id, nextScheduledAt, errorMsg);

        console.warn(
          `[notification-worker] retry scheduled: id=${entry.id} attempt=${nextAttemptIndex} backoff=${backoffSeconds}s`,
        );
      }
    }
  }
}
