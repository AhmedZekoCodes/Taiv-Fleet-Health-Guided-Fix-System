/*
this controller handles http for the incident read endpoints.
it validates query params and delegates all logic to the service.
*/

import { Request, Response, NextFunction } from 'express';
import { IncidentService } from '../services/IncidentService';
import { IncidentQuerySchema } from './dtos/IncidentQueryDto';

// handles GET /api/incidents with optional active, deviceId, limit, offset params
export function listIncidents(service: IncidentService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = IncidentQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({ error: 'invalid query params', details: parsed.error.issues });
      return;
    }

    try {
      const result = service.listIncidents({
        onlyActive: parsed.data.active,
        deviceId: parsed.data.deviceId,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}

// handles GET /api/incidents/:id — returns 404 if the incident does not exist
export function getIncidentById(service: IncidentService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { id } = req.params;

    try {
      const incident = service.getIncidentById(id);

      if (!incident) {
        res.status(404).json({ error: 'incident not found' });
        return;
      }

      res.json(incident);
    } catch (err) {
      next(err);
    }
  };
}
