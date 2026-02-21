/*
this file maps http routes to controller functions for the heartbeat flow.
only route wiring happens here — no business logic, no validation.
*/

import { Router } from 'express';
import { HeartbeatService } from '../services/HeartbeatService';
import { handleHeartbeat } from '../controllers/HeartbeatController';

export function createHeartbeatRouter(service: HeartbeatService): Router {
  const router = Router();

  // devices post to this endpoint every few seconds to report their health
  router.post('/heartbeat', handleHeartbeat(service));

  return router;
}
