/*
this contract is the only way the notification service accesses venue contact data.
no service or rule may bypass this interface to touch sqlite directly.
*/

import { VenueContact } from '../domain/Notification';

export interface IVenueContactRepository {
  // returns all active contacts for the given venue, across all channels
  listActiveByVenueId(venueId: string): VenueContact[];
  // inserts or replaces a contact record (used in tests and dev seeding)
  upsert(contact: VenueContact): void;
}
