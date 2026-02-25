/*
this service handles the read side for devices.
it orchestrates between the device and incident repositories to build full responses.
when an outbox repository is injected, it also enriches each incident with notification status.
*/

import { IDeviceRepository, DeviceListFilters, DeviceListItem } from '../repositories/IDeviceRepository';
import { IIncidentRepository } from '../repositories/IIncidentRepository';
import { INotificationOutboxRepository } from '../repositories/INotificationOutboxRepository';
import { Device } from '../domain/Device';
import { Incident } from '../domain/Incident';
import { NotificationStatusSummary } from '../domain/Notification';
import { PaginatedResult } from '../domain/Pagination';

// an incident enriched with its current notification delivery status
export interface IncidentWithNotifications extends Incident {
  notificationStatus: NotificationStatusSummary;
}

// the full device detail response — device record plus its open incidents
export interface DeviceDetail {
  device: Device;
  openIncidents: IncidentWithNotifications[];
}

export class DeviceService {
  private readonly deviceRepo: IDeviceRepository;
  private readonly incidentRepo: IIncidentRepository;
  // optional — when omitted, all notification summaries return zeros
  private readonly outboxRepo: INotificationOutboxRepository | null;

  constructor(
    deviceRepo: IDeviceRepository,
    incidentRepo: IIncidentRepository,
    outboxRepo: INotificationOutboxRepository | null = null,
  ) {
    this.deviceRepo = deviceRepo;
    this.incidentRepo = incidentRepo;
    this.outboxRepo = outboxRepo;
  }

  // returns a paginated, filtered list of devices with open incident counts
  listDevices(filters: DeviceListFilters): PaginatedResult<DeviceListItem> {
    return this.deviceRepo.listWithFilters(filters);
  }

  // returns a single device with its open incidents (and their notification status)
  getDeviceDetail(id: string): DeviceDetail | null {
    const device = this.deviceRepo.findById(id);

    if (!device) {
      return null;
    }

    const incidents = this.incidentRepo.findOpenByDeviceId(id);
    const openIncidents = incidents.map((incident) =>
      this.enrichWithNotifications(incident),
    );

    return { device, openIncidents };
  }

  // attaches notification status to an incident, using zeros when outbox is not wired
  private enrichWithNotifications(incident: Incident): IncidentWithNotifications {
    const notificationStatus = this.outboxRepo
      ? this.outboxRepo.summarizeByIncidentId(incident.id)
      : { total: 0, sent: 0, pending: 0, failed: 0 };

    return { ...incident, notificationStatus };
  }
}
