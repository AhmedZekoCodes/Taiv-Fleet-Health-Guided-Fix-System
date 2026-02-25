/*
this file holds the domain types for the notification system.
a venue contact is a person who gets notified when something breaks.
an outbox entry tracks one pending or completed notification send attempt.
*/

import { NotificationChannel, NotificationStatus } from './enums';

// a person at a venue who should receive incident notifications
export interface VenueContact {
  id: string;
  venueId: string;
  name: string;
  // email is required when channel includes EMAIL
  email: string | null;
  // phone is required when channel includes SMS
  phone: string | null;
  // which channels this contact accepts
  channels: NotificationChannel[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// one pending send for a specific incident + channel + recipient combination.
// the unique constraint on (incident_id, channel, to_address) is the idempotency key.
export interface OutboxEntry {
  id: string;
  incidentId: string;
  venueId: string;
  channel: NotificationChannel;
  // email address or phone number depending on channel
  toAddress: string;
  subject: string | null;
  body: string;
  status: NotificationStatus;
  attemptCount: number;
  lastError: string | null;
  // the earliest time the worker is allowed to attempt this entry
  scheduledAt: Date;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// the data needed to create a new outbox entry (before id and timestamps are set)
export interface NewOutboxEntry {
  incidentId: string;
  venueId: string;
  channel: NotificationChannel;
  toAddress: string;
  subject: string | null;
  body: string;
  scheduledAt: Date;
}

// a compact summary of all outbox entries for one incident, used in api responses
export interface NotificationStatusSummary {
  total: number;
  sent: number;
  pending: number;
  failed: number;
}
