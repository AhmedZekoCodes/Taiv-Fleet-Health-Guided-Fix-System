/*
this is the strategy interface for sending notifications.
each channel (email, sms) has its own implementation.
the worker only knows about this interface, so real adapters can replace stubs later.
*/

import { NotificationChannel } from '../domain/enums';
import { OutboxEntry } from '../domain/Notification';

export interface INotificationSender {
  // identifies which channel this sender handles
  readonly channel: NotificationChannel;

  // sends the notification described by the outbox entry.
  // throws on failure so the worker can record the error and retry.
  send(entry: OutboxEntry): Promise<void>;
}
