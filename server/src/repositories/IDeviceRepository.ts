/*
this is the contract every device repository must follow.
services depend on this interface, not on sqlite directly (dependency inversion).
*/

import { Device } from '../domain/Device';

export interface IDeviceRepository {
  // finds a device by its unique id, returns null if it does not exist
  findById(id: string): Device | null;
  // inserts a new device or updates all mutable fields if the id already exists
  upsert(device: Device): void;
  // returns every device in the fleet
  findAll(): Device[];
}
