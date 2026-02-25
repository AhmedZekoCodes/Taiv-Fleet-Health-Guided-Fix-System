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
import { SqliteVenueContactRepository } from './repositories/sqlite/SqliteVenueContactRepository';
import { SqliteNotificationOutboxRepository } from './repositories/sqlite/SqliteNotificationOutboxRepository';
import { HeartbeatService } from './services/HeartbeatService';
import { DeviceService } from './services/DeviceService';
import { IncidentService } from './services/IncidentService';
import { NotificationService } from './services/NotificationService';
import { NotificationComposer } from './services/NotificationComposer';
import { NotificationWorker } from './notifications/NotificationWorker';
import { EmailStubSender } from './notifications/EmailStubSender';
import { SmsStubSender } from './notifications/SmsStubSender';
import { createDefaultIncidentPipeline } from './rules';
import { NotificationChannel } from './domain/enums';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const DB_PATH = path.resolve(__dirname, '../data/dev.db');

// open and migrate the database
const db = openDatabase(DB_PATH);
runMigrations(db);

// wire all dependencies bottom-up: db → repos → pipeline → services → app
const deviceRepo = new SqliteDeviceRepository(db);
const incidentRepo = new SqliteIncidentRepository(db);
const contactRepo = new SqliteVenueContactRepository(db);
const outboxRepo = new SqliteNotificationOutboxRepository(db);

const { ruleEngine, stepFactory } = createDefaultIncidentPipeline();

const composer = new NotificationComposer();
const notificationService = new NotificationService(contactRepo, outboxRepo, composer);
const worker = new NotificationWorker(outboxRepo, [new EmailStubSender(), new SmsStubSender()]);

const heartbeatService = new HeartbeatService(
  deviceRepo,
  incidentRepo,
  ruleEngine,
  stepFactory,
  notificationService,
);
const deviceService = new DeviceService(deviceRepo, incidentRepo, outboxRepo);
const incidentService = new IncidentService(incidentRepo, outboxRepo);

const app = createApp({ heartbeatService, deviceService, incidentService });

// seed one demo contact per sim venue so the console shows notifications during the demo.
// this only inserts if the record does not already exist (upsert by id).
function seedDemoContacts(): void {
  const now = new Date();
  for (let i = 1; i <= 8; i++) {
    const venueId = `sim-venue-0${i}`;
    contactRepo.upsert({
      id: `demo-contact-${i}`,
      venueId,
      name: `Venue ${i} Manager`,
      email: `manager-${i}@taiv.demo`,
      phone: `+1555000000${i}`,
      channels: [NotificationChannel.EMAIL, NotificationChannel.SMS],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log('[server] demo venue contacts seeded');
}

seedDemoContacts();

const server = app.listen(PORT, () => {
  console.log(`[server] taiv fleet health server running on port ${PORT}`);
  // start the outbox worker after the server is bound
  worker.start();
});

// close the db connection and stop accepting new requests on shutdown signals
function shutdown(signal: string): void {
  console.log(`[server] received ${signal}, shutting down gracefully`);
  worker.stop();
  server.close(() => {
    closeDatabase(db);
    console.log('[server] shutdown complete');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
