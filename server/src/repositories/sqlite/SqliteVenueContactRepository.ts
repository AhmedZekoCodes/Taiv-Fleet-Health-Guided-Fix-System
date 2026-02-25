/*
sqlite implementation of IVenueContactRepository.
channels are stored as a comma-separated string and parsed back to an array on read.
*/

import { DatabaseSync } from 'node:sqlite';
import { IVenueContactRepository } from '../IVenueContactRepository';
import { VenueContact } from '../../domain/Notification';
import { NotificationChannel } from '../../domain/enums';

// shape of one row as returned by sqlite
interface ContactRow {
  id: string;
  venue_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  channels: string;
  is_active: number;
  created_at: number;
  updated_at: number;
}

// parses a stored channel string like 'EMAIL,SMS' into a typed array
function parseChannels(raw: string): NotificationChannel[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is NotificationChannel =>
      Object.values(NotificationChannel).includes(s as NotificationChannel),
    );
}

// maps a database row to the VenueContact domain model
function rowToContact(row: ContactRow): VenueContact {
  return {
    id: row.id,
    venueId: row.venue_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    channels: parseChannels(row.channels),
    isActive: row.is_active === 1,
    createdAt: new Date(row.created_at * 1000),
    updatedAt: new Date(row.updated_at * 1000),
  };
}

export class SqliteVenueContactRepository implements IVenueContactRepository {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  listActiveByVenueId(venueId: string): VenueContact[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM venue_contacts
         WHERE venue_id = ? AND is_active = 1
         ORDER BY created_at ASC`,
      )
      .all(venueId) as unknown as ContactRow[];

    return rows.map(rowToContact);
  }

  upsert(contact: VenueContact): void {
    const nowSeconds = Math.floor(contact.updatedAt.getTime() / 1000);
    const createdSeconds = Math.floor(contact.createdAt.getTime() / 1000);

    this.db
      .prepare(
        `INSERT INTO venue_contacts
           (id, venue_id, name, email, phone, channels, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name       = excluded.name,
           email      = excluded.email,
           phone      = excluded.phone,
           channels   = excluded.channels,
           is_active  = excluded.is_active,
           updated_at = excluded.updated_at`,
      )
      .run(
        contact.id,
        contact.venueId,
        contact.name,
        contact.email,
        contact.phone,
        contact.channels.join(','),
        contact.isActive ? 1 : 0,
        createdSeconds,
        nowSeconds,
      );
  }
}
