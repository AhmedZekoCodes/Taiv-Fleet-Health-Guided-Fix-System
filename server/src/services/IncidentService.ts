/*
this service handles the read side for incidents.
when an outbox repository is injected, each incident is enriched with notification delivery status.
*/

import { IIncidentRepository, IncidentListFilters } from '../repositories/IIncidentRepository';
import { INotificationOutboxRepository } from '../repositories/INotificationOutboxRepository';
import { Incident } from '../domain/Incident';
import { NotificationStatusSummary } from '../domain/Notification';
import { PaginatedResult } from '../domain/Pagination';

// an incident enriched with its current notification delivery status
export interface IncidentWithNotifications extends Incident {
  notificationStatus: NotificationStatusSummary;
}

export class IncidentService {
  private readonly incidentRepo: IIncidentRepository;
  // optional — when omitted, notification summaries return zeros
  private readonly outboxRepo: INotificationOutboxRepository | null;

  constructor(
    incidentRepo: IIncidentRepository,
    outboxRepo: INotificationOutboxRepository | null = null,
  ) {
    this.incidentRepo = incidentRepo;
    this.outboxRepo = outboxRepo;
  }

  // returns a paginated list of incidents, optionally filtered to active/all
  listIncidents(filters: IncidentListFilters): PaginatedResult<IncidentWithNotifications> {
    const result = this.incidentRepo.listWithFilters(filters);
    return {
      ...result,
      items: result.items.map((i) => this.enrichWithNotifications(i)),
    };
  }

  // returns a single incident by id with its notification status, or null if not found
  getIncidentById(id: string): IncidentWithNotifications | null {
    const incident = this.incidentRepo.findById(id);
    if (!incident) return null;
    return this.enrichWithNotifications(incident);
  }

  // attaches a notification status summary to the incident
  private enrichWithNotifications(incident: Incident): IncidentWithNotifications {
    const notificationStatus = this.outboxRepo
      ? this.outboxRepo.summarizeByIncidentId(incident.id)
      : { total: 0, sent: 0, pending: 0, failed: 0 };

    return { ...incident, notificationStatus };
  }
}
