/*
this controller handles http for the device read endpoints.
it parses and validates query params then calls the service — no business logic here.
*/

import { Request, Response, NextFunction } from 'express';
import { DeviceService } from '../services/DeviceService';
import { DeviceQuerySchema } from './dtos/DeviceQueryDto';

// handles GET /api/devices with optional status, venueId, limit, offset params
export function listDevices(service: DeviceService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = DeviceQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({ error: 'invalid query params', details: parsed.error.issues });
      return;
    }

    try {
      const result = service.listDevices(parsed.data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}

// handles GET /api/devices/:id — returns device detail and open incidents
export function getDeviceDetail(service: DeviceService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { id } = req.params;

    try {
      const result = service.getDeviceDetail(id);

      if (!result) {
        res.status(404).json({ error: 'device not found' });
        return;
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
