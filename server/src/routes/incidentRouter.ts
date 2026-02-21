/*
this file maps incident http routes to their controller handlers.
no logic lives here — only route registration.
*/

import { Router } from 'express';
import { IncidentService } from '../services/IncidentService';
import { listIncidents, getIncidentById } from '../controllers/IncidentController';

export function createIncidentRouter(service: IncidentService): Router {
  const router = Router();

  // GET /api/incidents — paginated list with active/device filters
  router.get('/incidents', listIncidents(service));

  // GET /api/incidents/:id — single incident detail with troubleshooting steps
  router.get('/incidents/:id', getIncidentById(service));

  return router;
}
