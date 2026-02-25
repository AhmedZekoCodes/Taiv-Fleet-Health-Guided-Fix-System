/*
stub sms sender for local development and testing.
it prints the message to the console instead of calling a real sms gateway.
swap this with a twilio or sinch adapter in production without changing any other code.
*/

import { INotificationSender } from './INotificationSender';
import { NotificationChannel } from '../domain/enums';
import { OutboxEntry } from '../domain/Notification';

export class SmsStubSender implements INotificationSender {
  readonly channel = NotificationChannel.SMS;

  send(entry: OutboxEntry): Promise<void> {
    // log so the demo shows something meaningful in the console
    console.log(
      `[sms-stub] to=${entry.toAddress} | incident=${entry.incidentId} | venue=${entry.venueId}\n` +
      `  body: ${entry.body.slice(0, 160)}`,
    );
    return Promise.resolve();
  }
}
