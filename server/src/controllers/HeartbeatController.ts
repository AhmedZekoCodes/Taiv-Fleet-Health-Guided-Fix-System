/*
this controller handles the http layer for the heartbeat endpoint.
it only parses the request, validates the body, and delegates to the service.
*/

import { Request, Response, NextFunction } from 'express';
import { HeartbeatService } from '../services/HeartbeatService';
import { HeartbeatDtoSchema } from './dtos/HeartbeatDto';

// returns an express handler bound to the given service instance
export function handleHeartbeat(service: HeartbeatService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = HeartbeatDtoSchema.safeParse(req.body);

    if (!parsed.success) {
      // return the zod issues so the caller knows what field failed
      res.status(400).json({
        error: 'invalid request body',
        details: parsed.error.issues,
      });
      return;
    }

    try {
      const result = service.handleHeartbeat(parsed.data);
      res.status(200).json(result);
    } catch (err) {
      // pass unexpected errors to the global express error handler
      next(err);
    }
  };
}
