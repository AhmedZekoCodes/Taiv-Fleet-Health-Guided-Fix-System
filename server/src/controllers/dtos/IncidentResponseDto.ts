/*
these types describe the json shape the incident endpoints return.
they are minimal by design — only the fields tests actually read are listed.
*/

// a single troubleshooting step as returned in the incident detail
export interface ResponseStep {
  order: number;
  title: string;
  description: string;
  requiresConfirmation: boolean;
}

// a single incident as returned in list or detail responses
export interface ResponseIncident {
  id: string;
  deviceId: string;
  venueId: string;
  type: string;
  severity: string;
  status: string;
  summary: string;
  resolvedAt: string | null;
  troubleshootingSteps: ResponseStep[];
}

// the paginated wrapper used by the incident list endpoint
export interface ResponsePaginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// GET /api/incidents list body
export type IncidentListResponseBody = ResponsePaginated<ResponseIncident>;

// GET /api/incidents/:id body — just the incident itself
export type IncidentDetailResponseBody = ResponseIncident;
