/*
these tests cover the full heartbeat flow end-to-end through the http layer.
each test group uses an in-memory sqlite database so there is no file i/o.
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
import { createDefaultIncidentPipeline } from '../../rules';
import { NO_RENDER_THRESHOLD_SECONDS } from '../../domain/constants';
import {
  HeartbeatSuccessBody,
  HeartbeatErrorBody,
} from '../../controllers/dtos/HeartbeatResponseDto';

// lifts res.body from supertest's `any` to unknown, then narrows to T.
// this is the only place we touch res.body directly so eslint no-unsafe-member-access
// never fires anywhere else in the test file.
function getBody<T>(res: Response): T {
  return res.body as unknown as T;
}

// builds a fully wired app backed by an in-memory sqlite database
function buildTestApp(db: DatabaseSync): Application {
  runMigrations(db);
  const deviceRepo = new SqliteDeviceRepository(db);
  const incidentRepo = new SqliteIncidentRepository(db);
  const { ruleEngine, stepFactory } = createDefaultIncidentPipeline();
  const service = new HeartbeatService(deviceRepo, incidentRepo, ruleEngine, stepFactory);
  return createApp({ heartbeatService: service });
}

// clears all rows between tests so each test starts with a clean slate
function resetDb(db: DatabaseSync): void {
  db.exec('DELETE FROM incidents; DELETE FROM devices;');
}

describe('POST /api/heartbeat', () => {
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

  // --- test a: creating and updating a device row ---

  it('returns 400 when the request body is missing required fields', async () => {
    const res = await request(app).post('/api/heartbeat').send({});
    const body = getBody<HeartbeatErrorBody>(res);
    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid request body');
  });

  it('creates a new device row on the first heartbeat', async () => {
    const res = await request(app).post('/api/heartbeat').send({
      deviceId: 'device-001',
      venueId: 'venue-001',
      label: 'Bar TV 1',
    });
    const body = getBody<HeartbeatSuccessBody>(res);

    expect(res.status).toBe(200);
    expect(body.device.id).toBe('device-001');
    expect(body.device.venueId).toBe('venue-001');
    expect(body.device.label).toBe('Bar TV 1');
  });

  it('marks the device as online when all telemetry is healthy', async () => {
    const now = Math.floor(Date.now() / 1000);
    const res = await request(app).post('/api/heartbeat').send({
      deviceId: 'device-002',
      venueId: 'venue-001',
      label: 'Bar TV 2',
      // fresh render and detection timestamps — no rules should fire
      lastRenderAt: now - 30,
      lastDetectionAt: now - 60,
      signalStrengthPercent: 80,
      rssiDbm: -55,
    });
    const body = getBody<HeartbeatSuccessBody>(res);

    expect(res.status).toBe(200);
    expect(body.device.status).toBe('ONLINE');
    expect(body.newIncidents).toHaveLength(0);
  });

  it('updates the device on a subsequent heartbeat from the same device', async () => {
    await request(app).post('/api/heartbeat').send({
      deviceId: 'device-003',
      venueId: 'venue-001',
      label: 'Bar TV 3',
      firmwareVersion: '1.0.0',
    });

    const res = await request(app).post('/api/heartbeat').send({
      deviceId: 'device-003',
      venueId: 'venue-001',
      label: 'Bar TV 3',
      firmwareVersion: '1.1.0',
    });
    const body = getBody<HeartbeatSuccessBody>(res);

    expect(res.status).toBe(200);
    expect(body.device.telemetry.firmwareVersion).toBe('1.1.0');
  });

  // --- test b: triggering an incident via a bad heartbeat ---

  it('creates a NO_RENDER incident when the device reports a stale render timestamp', async () => {
    const now = Math.floor(Date.now() / 1000);
    // put lastRenderAt well past the no-render threshold
    const staleRenderAt = now - (NO_RENDER_THRESHOLD_SECONDS + 100);

    const res = await request(app).post('/api/heartbeat').send({
      deviceId: 'device-010',
      venueId: 'venue-001',
      label: 'Lounge TV 1',
      lastRenderAt: staleRenderAt,
      // fresh detection prevents DetectionStaleRule from also firing
      lastDetectionAt: now - 30,
      signalStrengthPercent: 80,
      rssiDbm: -55,
    });
    const body = getBody<HeartbeatSuccessBody>(res);

    expect(res.status).toBe(200);
    expect(body.device.status).toBe('DEGRADED');
    expect(body.newIncidents).toHaveLength(1);
    expect(body.newIncidents[0].type).toBe('NO_RENDER');
    expect(body.newIncidents[0].status).toBe('OPEN');
    // each incident must have at least one guided step
    expect(body.newIncidents[0].troubleshootingSteps.length).toBeGreaterThan(0);
  });

  it('creates a WEAK_NETWORK incident when signal is below threshold', async () => {
    const res = await request(app).post('/api/heartbeat').send({
      deviceId: 'device-011',
      venueId: 'venue-001',
      label: 'Patio TV 1',
      signalStrengthPercent: 5,
      rssiDbm: -90,
    });
    const body = getBody<HeartbeatSuccessBody>(res);

    expect(res.status).toBe(200);
    const types = body.newIncidents.map((i) => i.type);
    expect(types).toContain('WEAK_NETWORK');
  });

  it('does not duplicate an incident when the same problem persists across heartbeats', async () => {
    const now = Math.floor(Date.now() / 1000);
    const staleRenderAt = now - (NO_RENDER_THRESHOLD_SECONDS + 100);

    const payload = {
      deviceId: 'device-012',
      venueId: 'venue-001',
      label: 'Entry TV 1',
      lastRenderAt: staleRenderAt,
      // keep detection fresh so only the no-render rule fires
      lastDetectionAt: now - 30,
      signalStrengthPercent: 80,
      rssiDbm: -55,
    };

    // first heartbeat — creates incident
    const res1 = await request(app).post('/api/heartbeat').send(payload);
    expect(getBody<HeartbeatSuccessBody>(res1).newIncidents).toHaveLength(1);

    // second heartbeat — same bad state, should not create a duplicate
    const res2 = await request(app).post('/api/heartbeat').send(payload);
    const body2 = getBody<HeartbeatSuccessBody>(res2);
    expect(body2.newIncidents).toHaveLength(0);
    expect(body2.resolvedIncidents).toHaveLength(0);
  });

  // --- test c: auto-resolving an incident when the device recovers ---

  it('resolves a NO_RENDER incident when the device reports a fresh render timestamp', async () => {
    const now = Math.floor(Date.now() / 1000);
    const staleRenderAt = now - (NO_RENDER_THRESHOLD_SECONDS + 100);
    // keep detection fresh on both heartbeats so only the render rule is in play
    const freshDetectionAt = now - 30;

    // first heartbeat — bad render, incident opens
    await request(app).post('/api/heartbeat').send({
      deviceId: 'device-020',
      venueId: 'venue-001',
      label: 'Dining TV 1',
      lastRenderAt: staleRenderAt,
      lastDetectionAt: freshDetectionAt,
      signalStrengthPercent: 80,
      rssiDbm: -55,
    });

    // second heartbeat — render is now fresh, incident should resolve
    const freshRenderAt = now - 10;
    const res = await request(app).post('/api/heartbeat').send({
      deviceId: 'device-020',
      venueId: 'venue-001',
      label: 'Dining TV 1',
      lastRenderAt: freshRenderAt,
      lastDetectionAt: freshDetectionAt,
      signalStrengthPercent: 80,
      rssiDbm: -55,
    });
    const body = getBody<HeartbeatSuccessBody>(res);

    expect(res.status).toBe(200);
    expect(body.device.status).toBe('ONLINE');
    expect(body.newIncidents).toHaveLength(0);
    expect(body.resolvedIncidents).toHaveLength(1);
    expect(body.resolvedIncidents[0].type).toBe('NO_RENDER');
    expect(body.resolvedIncidents[0].status).toBe('RESOLVED');
    // resolved_at must be set
    expect(body.resolvedIncidents[0].resolvedAt).not.toBeNull();
  });

  it('resolves a WEAK_NETWORK incident when signal improves', async () => {
    // first heartbeat — weak signal
    await request(app).post('/api/heartbeat').send({
      deviceId: 'device-021',
      venueId: 'venue-001',
      label: 'Bar TV 4',
      signalStrengthPercent: 5,
      rssiDbm: -90,
    });

    // second heartbeat — signal is healthy
    const res = await request(app).post('/api/heartbeat').send({
      deviceId: 'device-021',
      venueId: 'venue-001',
      label: 'Bar TV 4',
      signalStrengthPercent: 80,
      rssiDbm: -50,
    });
    const body = getBody<HeartbeatSuccessBody>(res);

    expect(res.status).toBe(200);
    const resolved = body.resolvedIncidents.map((i) => i.type);
    expect(resolved).toContain('WEAK_NETWORK');
  });
});
