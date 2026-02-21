/*
these tests cover GET /api/incidents and GET /api/incidents/:id.
each test suite runs against an isolated in-memory sqlite database.
*/

import request, { Response } from 'supertest';
import { Application } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../app';
import { openDatabase, closeDatabase } from '../../db/sqlite';
import { runMigrations } from '../../db/migrate';
import { SqliteDeviceRepository } from '../../repositories/sqlite/SqliteDeviceRepository';
import { SqliteIncidentRepository } from '../../repositories/sqlite/SqliteIncidentRepository';
import { HeartbeatService } from '../../services/HeartbeatService';
import { DeviceService } from '../../services/DeviceService';
import { IncidentService } from '../../services/IncidentService';
import { createDefaultIncidentPipeline } from '../../rules';
import { NO_RENDER_THRESHOLD_SECONDS } from '../../domain/constants';
import {
  IncidentListResponseBody,
  IncidentDetailResponseBody,
} from '../../controllers/dtos/IncidentResponseDto';

// narrows supertest res.body from any to a typed T to avoid eslint no-unsafe-member-access
function getBody<T>(res: Response): T {
  return res.body as unknown as T;
}

// builds a fully wired app backed by an in-memory sqlite database
function buildTestApp(db: DatabaseSync): Application {
  runMigrations(db);
  const deviceRepo = new SqliteDeviceRepository(db);
  const incidentRepo = new SqliteIncidentRepository(db);
  const { ruleEngine, stepFactory } = createDefaultIncidentPipeline();
  const heartbeatService = new HeartbeatService(deviceRepo, incidentRepo, ruleEngine, stepFactory);
  const deviceService = new DeviceService(deviceRepo, incidentRepo);
  const incidentService = new IncidentService(incidentRepo);
  return createApp({ heartbeatService, deviceService, incidentService });
}

function resetDb(db: DatabaseSync): void {
  db.exec('DELETE FROM incidents; DELETE FROM devices;');
}

describe('GET /api/incidents', () => {
  let db: DatabaseSync;
  let app: Application;

  beforeAll(() => {
    db = openDatabase(':memory:');
    app = buildTestApp(db);
  });

  beforeEach(() => {
    resetDb(db);
  });

  afterAll(() => {
    closeDatabase(db);
  });

  it('returns an empty paginated list when no incidents exist', async () => {
    const res = await request(app).get('/api/incidents');
    const body = getBody<IncidentListResponseBody>(res);

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(0);
    expect(body.total).toBe(0);
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });

  it('returns active incidents with all required fields and troubleshooting steps', async () => {
    const now = Math.floor(Date.now() / 1000);

    await request(app).post('/api/heartbeat').send({
      deviceId: 'd-200',
      venueId: 'v-010',
      label: 'Entry TV 1',
      lastRenderAt: now - (NO_RENDER_THRESHOLD_SECONDS + 100),
      lastDetectionAt: now - 30,
      signalStrengthPercent: 80,
      rssiDbm: -50,
    });

    const res = await request(app).get('/api/incidents');
    const body = getBody<IncidentListResponseBody>(res);

    expect(res.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);

    const incident = body.items[0];
    expect(incident.type).toBe('NO_RENDER');
    expect(incident.status).toBe('OPEN');
    expect(incident.severity).toBe('HIGH');
    expect(incident.deviceId).toBe('d-200');
    expect(incident.venueId).toBe('v-010');
    // each active incident must have guided troubleshooting steps
    expect(incident.troubleshootingSteps.length).toBeGreaterThan(0);
    expect(incident.resolvedAt).toBeNull();
  });

  it('defaults to returning only active (open) incidents', async () => {
    const now = Math.floor(Date.now() / 1000);

    // post a bad heartbeat to create an incident
    await request(app).post('/api/heartbeat').send({
      deviceId: 'd-201',
      venueId: 'v-010',
      label: 'Bar TV X',
      lastRenderAt: now - (NO_RENDER_THRESHOLD_SECONDS + 100),
      lastDetectionAt: now - 30,
      signalStrengthPercent: 80,
      rssiDbm: -50,
    });

    // resolve it by sending a good heartbeat
    await request(app).post('/api/heartbeat').send({
      deviceId: 'd-201',
      venueId: 'v-010',
      label: 'Bar TV X',
      lastRenderAt: now - 10,
      lastDetectionAt: now - 30,
      signalStrengthPercent: 80,
      rssiDbm: -50,
    });

    // default (active=true) should return 0 open incidents
    const res = await request(app).get('/api/incidents');
    const body = getBody<IncidentListResponseBody>(res);

    expect(body.total).toBe(0);
    expect(body.items).toHaveLength(0);
  });

  it('returns all incidents including resolved when active=false', async () => {
    const now = Math.floor(Date.now() / 1000);

    // create and then resolve an incident
    await request(app).post('/api/heartbeat').send({
      deviceId: 'd-202',
      venueId: 'v-010',
      label: 'Patio TV 1',
      lastRenderAt: now - (NO_RENDER_THRESHOLD_SECONDS + 100),
      lastDetectionAt: now - 30,
      signalStrengthPercent: 80,
      rssiDbm: -50,
    });

    await request(app).post('/api/heartbeat').send({
      deviceId: 'd-202',
      venueId: 'v-010',
      label: 'Patio TV 1',
      lastRenderAt: now - 10,
      lastDetectionAt: now - 30,
      signalStrengthPercent: 80,
      rssiDbm: -50,
    });

    const res = await request(app).get('/api/incidents?active=false');
    const body = getBody<IncidentListResponseBody>(res);

    // the resolved incident must appear in the full history
    expect(body.total).toBe(1);
    expect(body.items[0].status).toBe('RESOLVED');
    expect(body.items[0].resolvedAt).not.toBeNull();
  });

  it('filters by deviceId when the deviceId query param is provided', async () => {
    const now = Math.floor(Date.now() / 1000);

    // two devices with incidents
    for (const id of ['d-203', 'd-204']) {
      await request(app).post('/api/heartbeat').send({
        deviceId: id,
        venueId: 'v-010',
        label: `TV ${id}`,
        lastRenderAt: now - (NO_RENDER_THRESHOLD_SECONDS + 100),
        lastDetectionAt: now - 30,
        signalStrengthPercent: 80,
        rssiDbm: -50,
      });
    }

    const res = await request(app).get('/api/incidents?deviceId=d-203');
    const body = getBody<IncidentListResponseBody>(res);

    expect(body.total).toBe(1);
    expect(body.items[0].deviceId).toBe('d-203');
  });

  it('paginates results with limit and offset', async () => {
    const now = Math.floor(Date.now() / 1000);

    // create 3 incidents on 3 different devices
    for (let n = 1; n <= 3; n++) {
      await request(app).post('/api/heartbeat').send({
        deviceId: `d-page-i-${n}`,
        venueId: 'v-010',
        label: `Page TV ${n}`,
        lastRenderAt: now - (NO_RENDER_THRESHOLD_SECONDS + 100),
        lastDetectionAt: now - 30,
        signalStrengthPercent: 80,
        rssiDbm: -50,
      });
    }

    const res = await request(app).get('/api/incidents?limit=2&offset=0');
    const body = getBody<IncidentListResponseBody>(res);

    expect(body.total).toBe(3);
    expect(body.items).toHaveLength(2);
  });
});

describe('GET /api/incidents/:id', () => {
  let db: DatabaseSync;
  let app: Application;

  beforeAll(() => {
    db = openDatabase(':memory:');
    app = buildTestApp(db);
  });

  beforeEach(() => {
    resetDb(db);
  });

  afterAll(() => {
    closeDatabase(db);
  });

  it('returns 404 when the incident does not exist', async () => {
    const res = await request(app).get('/api/incidents/non-existent-id');
    expect(res.status).toBe(404);
  });

  it('returns full incident detail including troubleshooting steps by id', async () => {
    const now = Math.floor(Date.now() / 1000);

    // create an incident and capture its id from the heartbeat response
    const hbRes = await request(app).post('/api/heartbeat').send({
      deviceId: 'd-300',
      venueId: 'v-020',
      label: 'VIP Lounge TV',
      lastRenderAt: now - (NO_RENDER_THRESHOLD_SECONDS + 100),
      lastDetectionAt: now - 30,
      signalStrengthPercent: 80,
      rssiDbm: -50,
    });

    // the heartbeat response includes newIncidents with their ids
    const hbBody = hbRes.body as { newIncidents: { id: string }[] };
    const incidentId = hbBody.newIncidents[0].id;

    const res = await request(app).get(`/api/incidents/${incidentId}`);
    const body = getBody<IncidentDetailResponseBody>(res);

    expect(res.status).toBe(200);
    expect(body.id).toBe(incidentId);
    expect(body.type).toBe('NO_RENDER');
    expect(body.deviceId).toBe('d-300');
    expect(body.troubleshootingSteps.length).toBeGreaterThan(0);
    // first step should have a title and description
    expect(body.troubleshootingSteps[0].title).toBeTruthy();
    expect(body.troubleshootingSteps[0].description).toBeTruthy();
  });
});
