/*
this service handles the read side for incidents.
it is a thin orchestration layer that calls the incident repository and returns typed results.
*/

import { IIncidentRepository, IncidentListFilters } from '../repositories/IIncidentRepository';
import { Incident } from '../domain/Incident';
import { PaginatedResult } from '../domain/Pagination';

export class IncidentService {
  private readonly incidentRepo: IIncidentRepository;

  constructor(incidentRepo: IIncidentRepository) {
    this.incidentRepo = incidentRepo;
  }

  // returns a paginated list of incidents, optionally filtered to active/all
  listIncidents(filters: IncidentListFilters): PaginatedResult<Incident> {
    return this.incidentRepo.listWithFilters(filters);
  }

  // returns a single incident by id, or null if it does not exist
  getIncidentById(id: string): Incident | null {
    return this.incidentRepo.findById(id);
  }
}
