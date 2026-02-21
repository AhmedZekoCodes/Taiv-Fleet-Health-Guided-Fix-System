/*
this service handles the read side for devices.
it orchestrates between the device and incident repositories to build full responses.
*/

import { IDeviceRepository, DeviceListFilters, DeviceListItem } from '../repositories/IDeviceRepository';
import { IIncidentRepository } from '../repositories/IIncidentRepository';
import { Device } from '../domain/Device';
import { Incident } from '../domain/Incident';
import { PaginatedResult } from '../domain/Pagination';

// the full device detail response — device record plus its open incidents
export interface DeviceDetail {
  device: Device;
  openIncidents: Incident[];
}

export class DeviceService {
  private readonly deviceRepo: IDeviceRepository;
  private readonly incidentRepo: IIncidentRepository;

  constructor(deviceRepo: IDeviceRepository, incidentRepo: IIncidentRepository) {
    this.deviceRepo = deviceRepo;
    this.incidentRepo = incidentRepo;
  }

  // returns a paginated, filtered list of devices with open incident counts
  listDevices(filters: DeviceListFilters): PaginatedResult<DeviceListItem> {
    return this.deviceRepo.listWithFilters(filters);
  }

  // returns a single device with its open incidents, or null if not found
  getDeviceDetail(id: string): DeviceDetail | null {
    const device = this.deviceRepo.findById(id);

    if (!device) {
      return null;
    }

    const openIncidents = this.incidentRepo.findOpenByDeviceId(id);

    return { device, openIncidents };
  }
}
