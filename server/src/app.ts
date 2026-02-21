/*
this file builds and configures the express app.
keeping it separate from server.ts means tests can import the app without binding a port.
*/

import express, { Application, Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import { HeartbeatService } from './services/HeartbeatService';
import { createHeartbeatRouter } from './routes/heartbeatRouter';

// all service dependencies the app needs to operate
export interface AppDependencies {
  heartbeatService: HeartbeatService;
}

export function createApp(deps: AppDependencies): Application {
  const app = express();

  // parse incoming json bodies
  app.use(express.json());

  // log every request with method, path, status, and response time
  app.use(morgan('combined'));

  // health check so load balancers and ops can confirm the server is up
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // mount the heartbeat route under /api
  app.use('/api', createHeartbeatRouter(deps.heartbeatService));

  // catch-all for any route that does not exist
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not found' });
  });

  // global error handler — logs the error and returns a structured response
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[error]', err.message, err.stack);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}
