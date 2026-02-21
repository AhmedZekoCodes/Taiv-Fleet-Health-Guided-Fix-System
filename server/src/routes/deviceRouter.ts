/*
this file maps device http routes to their controller handlers.
no logic lives here — only route registration.
*/

import { Router } from 'express';
import { DeviceService } from '../services/DeviceService';
import { listDevices, getDeviceDetail } from '../controllers/DeviceController';

export function createDeviceRouter(service: DeviceService): Router {
  const router = Router();

  // GET /api/devices — paginated fleet list with open incident counts
  router.get('/devices', listDevices(service));

  // GET /api/devices/:id — full device record plus open incidents
  router.get('/devices/:id', getDeviceDetail(service));

  return router;
}
