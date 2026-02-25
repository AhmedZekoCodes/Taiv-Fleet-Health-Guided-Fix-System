/*
this class builds the outbox entries for a given incident and set of contacts.
it has no side effects — it just takes data in and returns rows to enqueue.
*/

import { Incident } from '../domain/Incident';
import { VenueContact, NewOutboxEntry } from '../domain/Notification';
import { NotificationChannel } from '../domain/enums';

export class NotificationComposer {
  // returns one outbox entry per (contact, channel) pair that is eligible for this incident
  compose(incident: Incident, contacts: VenueContact[]): NewOutboxEntry[] {
    const entries: NewOutboxEntry[] = [];
    const now = new Date();

    for (const contact of contacts) {
      for (const channel of contact.channels) {
        if (channel === NotificationChannel.EMAIL && contact.email) {
          entries.push({
            incidentId: incident.id,
            venueId: incident.venueId,
            channel,
            toAddress: contact.email,
            subject: this.buildEmailSubject(incident),
            body: this.buildEmailBody(incident, contact),
            scheduledAt: now,
          });
        }

        if (channel === NotificationChannel.SMS && contact.phone) {
          entries.push({
            incidentId: incident.id,
            venueId: incident.venueId,
            channel,
            toAddress: contact.phone,
            subject: null,
            body: this.buildSmsBody(incident),
            scheduledAt: now,
          });
        }
      }
    }

    return entries;
  }

  // subject line for email — concise enough to understand without opening the message
  private buildEmailSubject(incident: Incident): string {
    return `[Taiv Alert] ${incident.type.replace(/_/g, ' ')} — ${incident.severity} — Venue ${incident.venueId}`;
  }

  // full email body with context the venue contact needs to act on the problem
  private buildEmailBody(incident: Incident, contact: VenueContact): string {
    const detectedAt = incident.detectedAt.toISOString();
    const firstStep = incident.troubleshootingSteps[0];
    const firstAction = firstStep
      ? `\nFirst step: ${firstStep.title} — ${firstStep.description}`
      : '';

    return [
      `Hi ${contact.name},`,
      '',
      `An incident was detected at venue ${incident.venueId}.`,
      '',
      `Type:      ${incident.type.replace(/_/g, ' ')}`,
      `Severity:  ${incident.severity}`,
      `Device:    ${incident.deviceId}`,
      `Details:   ${incident.summary}`,
      `Detected:  ${detectedAt}`,
      firstAction,
      '',
      `View all steps in the Taiv Fleet Health dashboard.`,
      '',
      `Incident ID: ${incident.id}`,
    ].join('\n');
  }

  // sms body is kept under 160 chars to fit one standard sms message
  private buildSmsBody(incident: Incident): string {
    const type = incident.type.replace(/_/g, ' ');
    const raw = `Taiv Alert: ${type} (${incident.severity}) on device ${incident.deviceId} at venue ${incident.venueId}. Check dashboard.`;

    // truncate if it somehow exceeds sms length limit
    return raw.length > 160 ? raw.slice(0, 157) + '...' : raw;
  }
}
