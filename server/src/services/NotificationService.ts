/*
this service handles the notification side of incident creation.
it applies rate limiting and writes composed messages to the outbox.
actual sending is done by the NotificationWorker, not here.
*/

import { Incident } from '../domain/Incident';
import { IncidentType } from '../domain/enums';
import { INotificationService } from './INotificationService';
import { IVenueContactRepository } from '../repositories/IVenueContactRepository';
import { INotificationOutboxRepository } from '../repositories/INotificationOutboxRepository';
import { NotificationComposer } from './NotificationComposer';
import { NOTIFICATION_RATE_LIMIT_SECONDS } from '../domain/constants';

export class NotificationService implements INotificationService {
  private readonly contactRepo: IVenueContactRepository;
  private readonly outboxRepo: INotificationOutboxRepository;
  private readonly composer: NotificationComposer;
  private readonly clock: () => number;

  // in-memory rate limit map: key = "venueId:incidentType", value = last notified unix seconds.
  // this prevents spamming contacts when the same problem fires repeatedly at the same venue.
  private readonly rateLimitMap = new Map<string, number>();

  constructor(
    contactRepo: IVenueContactRepository,
    outboxRepo: INotificationOutboxRepository,
    composer: NotificationComposer,
    clock: () => number = () => Math.floor(Date.now() / 1000),
  ) {
    this.contactRepo = contactRepo;
    this.outboxRepo = outboxRepo;
    this.composer = composer;
    this.clock = clock;
  }

  onIncidentCreated(incident: Incident): void {
    // skip if this venue+type was already notified recently
    if (this.isRateLimited(incident.venueId, incident.type)) {
      console.log(
        `[notifications] rate-limited: venue=${incident.venueId} type=${incident.type}`,
      );
      return;
    }

    const contacts = this.contactRepo.listActiveByVenueId(incident.venueId);

    if (contacts.length === 0) {
      return;
    }

    const entries = this.composer.compose(incident, contacts);

    if (entries.length === 0) {
      return;
    }

    // enqueue is idempotent — the DB unique constraint prevents duplicate rows
    this.outboxRepo.enqueue(entries);

    // record the notification time so future incidents are rate-limited
    this.updateRateLimit(incident.venueId, incident.type);

    console.log(
      `[notifications] enqueued ${entries.length} message(s) for incident=${incident.id} venue=${incident.venueId}`,
    );
  }

  // returns true if this venue + incident type was notified within the rate limit window
  private isRateLimited(venueId: string, incidentType: IncidentType): boolean {
    const key = `${venueId}:${incidentType}`;
    const lastNotified = this.rateLimitMap.get(key);
    if (lastNotified === undefined) return false;
    return this.clock() - lastNotified < NOTIFICATION_RATE_LIMIT_SECONDS;
  }

  private updateRateLimit(venueId: string, incidentType: IncidentType): void {
    const key = `${venueId}:${incidentType}`;
    this.rateLimitMap.set(key, this.clock());
  }
}
