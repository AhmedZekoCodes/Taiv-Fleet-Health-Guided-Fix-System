/*
this represents a physical location (bar, restaurant, retail store) where taiv boxes are deployed.
a venue can have multiple devices installed.
*/

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  // contact info for the person at the venue responsible for the boxes
  contactName: string;
  contactPhone: string;
  createdAt: Date;
  updatedAt: Date;
}
