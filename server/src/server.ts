/*
this is the entry point that starts the http server.
it creates all dependencies, wires them together, then binds a port.
*/

import path from 'path';
import { createApp } from './app';
import { openDatabase, closeDatabase } from './db/sqlite';
import { runMigrations } from './db/migrate';
import { SqliteDeviceRepository } from './repositories/sqlite/SqliteDeviceRepository';
import { SqliteIncidentRepository } from './repositories/sqlite/SqliteIncidentRepository';
import { HeartbeatService } from './services/HeartbeatService';
import { DeviceService } from './services/DeviceService';
import { IncidentService } from './services/IncidentService';
import { createDefaultIncidentPipeline } from './rules';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const DB_PATH = path.resolve(__dirname, '../data/dev.db');

// open and migrate the database
const db = openDatabase(DB_PATH);
runMigrations(db);

// wire all dependencies bottom-up: db → repos → pipeline → services → app
const deviceRepo = new SqliteDeviceRepository(db);
const incidentRepo = new SqliteIncidentRepository(db);
const { ruleEngine, stepFactory } = createDefaultIncidentPipeline();

const heartbeatService = new HeartbeatService(deviceRepo, incidentRepo, ruleEngine, stepFactory);
const deviceService = new DeviceService(deviceRepo, incidentRepo);
const incidentService = new IncidentService(incidentRepo);

const app = createApp({ heartbeatService, deviceService, incidentService });

const server = app.listen(PORT, () => {
  console.log(`[server] taiv fleet health server running on port ${PORT}`);
});

// close the db connection and stop accepting new requests on shutdown signals
function shutdown(signal: string): void {
  console.log(`[server] received ${signal}, shutting down gracefully`);
  server.close(() => {
    closeDatabase(db);
    console.log('[server] shutdown complete');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
