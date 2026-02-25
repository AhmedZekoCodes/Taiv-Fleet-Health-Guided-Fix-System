/*
this interface decouples HeartbeatService from the notification implementation.
HeartbeatService depends on this contract, not on the concrete NotificationService class.
*/

import { Incident } from '../domain/Incident';

export interface INotificationService {
  // called after a new incident is persisted.
  // looks up venue contacts, applies rate limiting, and writes to the outbox.
  // synchronous — outbox writes go to sqlite; the worker handles the async sending.
  onIncidentCreated(incident: Incident): void;
}

// no-op implementation used in tests that do not care about notifications
export class NoOpNotificationService implements INotificationService {
  onIncidentCreated(_incident: Incident): void {
    // intentionally does nothing
  }
}
