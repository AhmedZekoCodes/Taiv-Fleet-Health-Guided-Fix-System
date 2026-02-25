/*
stub email sender for local development and testing.
it prints the message to the console instead of using smtp.
swap this with a real smtp adapter in production without changing any other code.
*/

import { INotificationSender } from './INotificationSender';
import { NotificationChannel } from '../domain/enums';
import { OutboxEntry } from '../domain/Notification';

export class EmailStubSender implements INotificationSender {
  readonly channel = NotificationChannel.EMAIL;

  send(entry: OutboxEntry): Promise<void> {
    // log so the demo shows something meaningful in the console
    console.log(
      `[email-stub] to=${entry.toAddress} | subject=${entry.subject ?? '(no subject)'}\n` +
      `  incident=${entry.incidentId} | venue=${entry.venueId}\n` +
      `  body preview: ${entry.body.slice(0, 120)}…`,
    );
    return Promise.resolve();
  }
}
