/*
these tests cover GET /api/devices and GET /api/devices/:id.
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
  DeviceListResponseBody,
  DeviceDetailResponseBody,
} from '../../controllers/dtos/DeviceResponseDto';

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

describe('GET /api/devices', () => {
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

  it('returns an empty paginated list when no devices exist', async () => {
    const res = await request(app).get('/api/devices');
    const body = getBody<DeviceListResponseBody>(res);

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(0);
    expect(body.total).toBe(0);
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });

  it('returns the correct fields for each device in the list', async () => {
    const now = Math.floor(Date.now() / 1000);

    await request(app).post('/api/heartbeat').send({
      deviceId: 'd-001',
      venueId: 'v-001',
      label: 'Bar TV 1',
      lastRenderAt: now - 30,
      lastDetectionAt: now - 30,
      signalStrengthPercent: 80,
      rssiDbm: -50,
    });

    const res = await request(app).get('/api/devices');
    const body = getBody<DeviceListResponseBody>(res);

    expect(res.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);

    const item = body.items[0];
    expect(item.id).toBe('d-001');
    expect(item.venueId).toBe('v-001');
    expect(item.label).toBe('Bar TV 1');
    expect(item.status).toBe('ONLINE');
    // lastSeenAt must be a valid iso date string
    expect(new Date(item.lastSeenAt).getTime()).toBeGreaterThan(0);
    expect(item.openIncidentCount).toBe(0);
  });

  it('includes openIncidentCount reflecting current open incidents', async () => {
    const now = Math.floor(Date.now() / 1000);
    // post a bad heartbeat so a NO_RENDER incident opens
    await request(app).post('/api/heartbeat').send({
      deviceId: 'd-002',
      venueId: 'v-001',
      label: 'Bar TV 2',
      lastRenderAt: now - (NO_RENDER_THRESHOLD_SECONDS + 100),
      lastDetectionAt: now - 30,
      signalStrengthPercent: 80,
      rssiDbm: -50,
    });

    const res = await request(app).get('/api/devices');
    const body = getBody<DeviceListResponseBody>(res);

    const device = body.items.find((i) => i.id === 'd-002');
    expect(device).toBeDefined();
    expect(device?.openIncidentCount).toBe(1);
  });

  it('filters by status when the status query param is provided', async () => {
    const now = Math.floor(Date.now() / 1000);

    // device A — healthy, will be ONLINE
    await request(app).post('/api/heartbeat').send({
      deviceId: 'd-010',
      venueId: 'v-001',
      label: 'TV 10',
      lastRenderAt: now - 30,
      lastDetectionAt: now - 30,
      signalStrengthPercent: 80,
      rssiDbm: -50,
    });

    // device B — bad signal, will be DEGRADED
    await request(app).post('/api/heartbeat').send({
      deviceId: 'd-011',
      venueId: 'v-001',
      label: 'TV 11',
      signalStrengthPercent: 5,
      rssiDbm: -92,
    });

    const res = await request(app).get('/api/devices?status=ONLINE');
    const body = getBody<DeviceListResponseBody>(res);

    const ids = body.items.map((i) => i.id);
    expect(ids).toContain('d-010');
    expect(ids).not.toContain('d-011');
  });

  it('paginates results with limit and offset', async () => {
    const now = Math.floor(Date.now() / 1000);

    // create 3 devices
    for (let n = 1; n <= 3; n++) {
      await request(app).post('/api/heartbeat').send({
        deviceId: `d-page-${n}`,
        venueId: 'v-001',
        label: `Page TV ${n}`,
        lastRenderAt: now - 30,
        lastDetectionAt: now - 30,
      });
    }

    const res = await request(app).get('/api/devices?limit=2&offset=0');
    const body = getBody<DeviceListResponseBody>(res);

    expect(body.total).toBe(3);
    expect(body.items).toHaveLength(2);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(0);
  });

  it('returns 400 when limit is out of range', async () => {
    const res = await request(app).get('/api/devices?limit=0');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/devices/:id', () => {
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

  it('returns 404 when the device does not exist', async () => {
    const res = await request(app).get('/api/devices/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('returns device detail with an empty open incident list for a healthy device', async () => {
    const now = Math.floor(Date.now() / 1000);
    await request(app).post('/api/heartbeat').send({
      deviceId: 'd-100',
      venueId: 'v-002',
      label: 'Dining TV 1',
      lastRenderAt: now - 30,
      lastDetectionAt: now - 30,
      signalStrengthPercent: 80,
      rssiDbm: -50,
    });

    const res = await request(app).get('/api/devices/d-100');
    const body = getBody<DeviceDetailResponseBody>(res);

    expect(res.status).toBe(200);
    expect(body.device.id).toBe('d-100');
    expect(body.device.venueId).toBe('v-002');
    expect(body.device.label).toBe('Dining TV 1');
    expect(body.device.status).toBe('ONLINE');
    expect(body.openIncidents).toHaveLength(0);
  });

  it('returns open incidents inside the device detail', async () => {
    const now = Math.floor(Date.now() / 1000);

    await request(app).post('/api/heartbeat').send({
      deviceId: 'd-101',
      venueId: 'v-002',
      label: 'Lounge TV 1',
      lastRenderAt: now - (NO_RENDER_THRESHOLD_SECONDS + 200),
      lastDetectionAt: now - 30,
      signalStrengthPercent: 80,
      rssiDbm: -50,
    });

    const res = await request(app).get('/api/devices/d-101');
    const body = getBody<DeviceDetailResponseBody>(res);

    expect(res.status).toBe(200);
    expect(body.openIncidents).toHaveLength(1);

    const incident = body.openIncidents[0];
    expect(incident.type).toBe('NO_RENDER');
    expect(incident.status).toBe('OPEN');
    // each incident in the detail view must include troubleshooting steps
    expect(incident.troubleshootingSteps.length).toBeGreaterThan(0);
  });
});
