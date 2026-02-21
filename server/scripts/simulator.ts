/*
this script simulates a real fleet of 30 devices sending heartbeats to the server.
it uses seeded randomness so every run produces the same incident sequence.
run with: npm run sim (starts fresh against the local dev.db)
*/

import path from 'path';
import { randomUUID } from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase, closeDatabase } from '../src/db/sqlite';
import { runMigrations } from '../src/db/migrate';
import { SqliteDeviceRepository } from '../src/repositories/sqlite/SqliteDeviceRepository';
import { SqliteIncidentRepository } from '../src/repositories/sqlite/SqliteIncidentRepository';
import { HeartbeatService } from '../src/services/HeartbeatService';
import { createDefaultIncidentPipeline } from '../src/rules';
import { RuleEngine } from '../src/rules/RuleEngine';
import { TroubleshootingStepFactory } from '../src/services/TroubleshootingStepFactory';
import { IDeviceRepository } from '../src/repositories/IDeviceRepository';
import { IIncidentRepository } from '../src/repositories/IIncidentRepository';
import { DeviceStatus, IncidentStatus, IncidentType } from '../src/domain/enums';
import { Incident } from '../src/domain/Incident';
import { OFFLINE_THRESHOLD_SECONDS } from '../src/domain/constants';

// how many rounds to run and how long to wait between rounds
const TOTAL_ROUNDS = 40;
const ROUND_INTERVAL_MS = 3000;

// which device indices (0-based) are assigned to each failure scenario
const OFFLINE_INDICES = [0, 1, 2];
const WEAK_NETWORK_INDICES = [3, 4, 5, 6, 7];
const NO_RENDER_INDICES = [8, 9];
const DETECTION_STALE_INDICES = [10, 11];

// phase boundaries (inclusive, 1-based round numbers)
const FAILURE_START = 11;
const FAILURE_END = 20;
const RECOVERY_START = 21;
const RECOVERY_END = 30;

/*
mulberry32 is a fast, well-distributed seeded prng.
using a fixed seed means every simulator run produces the same data.
*/
function mulberry32(seed: number): () => number {
  let s = seed;
  return function (): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// returns a float in [min, max)
function randBetween(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

// pauses execution for the given number of milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// inserts all 8 simulated venues if they do not already exist
function seedVenues(db: DatabaseSync, venueIds: string[]): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO venues (id, name, created_at, updated_at)
    VALUES (@id, @name, @createdAt, @updatedAt)
  `);
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < venueIds.length; i++) {
    insert.run({
      id: venueIds[i],
      name: `Sim Venue ${String(i + 1).padStart(2, '0')}`,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/*
evaluates a device that is already in the database without sending a new heartbeat.
this is used to check if offline or other stored-state conditions should fire.
it creates or resolves incidents the same way HeartbeatService does, but skips
updating the heartbeat timestamp — that stays as whatever is stored.
*/
function evaluateStoredDevice(
  deviceId: string,
  deviceRepo: IDeviceRepository,
  incidentRepo: IIncidentRepository,
  ruleEngine: RuleEngine,
  stepFactory: TroubleshootingStepFactory,
  nowSeconds: number,
): { newCount: number; resolvedCount: number } {
  const device = deviceRepo.findById(deviceId);

  if (!device) {
    return { newCount: 0, resolvedCount: 0 };
  }

  const nowDate = new Date(nowSeconds * 1000);
  const { matches } = ruleEngine.evaluate(device, nowSeconds);

  // compute new status based on what rules fired
  let newStatus = DeviceStatus.ONLINE;
  if (matches.some((m) => m.type === IncidentType.OFFLINE)) {
    newStatus = DeviceStatus.OFFLINE;
  } else if (matches.length > 0) {
    newStatus = DeviceStatus.DEGRADED;
  }

  // persist updated status without touching last_heartbeat_at (spread preserves stored telemetry)
  deviceRepo.upsert({ ...device, status: newStatus, updatedAt: nowDate });

  const openIncidents = incidentRepo.findOpenByDeviceId(deviceId);
  const matchedTypes = new Set(matches.map((m) => m.type));
  const stillOpenTypes = new Set<IncidentType>();
  let newCount = 0;
  let resolvedCount = 0;

  // resolve incidents whose rules no longer fire, keep the others open
  for (const incident of openIncidents) {
    if (matchedTypes.has(incident.type)) {
      incidentRepo.updateTimestamp(incident.id, nowDate);
      stillOpenTypes.add(incident.type);
    } else {
      incidentRepo.resolve(incident.id, nowDate);
      resolvedCount++;
    }
  }

  // open new incidents for newly triggered rules
  for (const match of matches) {
    if (stillOpenTypes.has(match.type)) {
      continue;
    }

    const steps = stepFactory.buildSteps(match, device);
    const incident: Incident = {
      id: randomUUID(),
      deviceId,
      venueId: device.venueId,
      type: match.type,
      severity: match.severity,
      status: IncidentStatus.OPEN,
      summary: match.summary,
      context: match.context,
      troubleshootingSteps: steps,
      detectedAt: nowDate,
      resolvedAt: null,
      updatedAt: nowDate,
    };

    incidentRepo.create(incident);
    newCount++;
  }

  return { newCount, resolvedCount };
}

async function runSimulation(): Promise<void> {
  const dbPath = path.resolve(__dirname, '../data/dev.db');
  const db = openDatabase(dbPath);
  runMigrations(db);

  const deviceRepo = new SqliteDeviceRepository(db);
  const incidentRepo = new SqliteIncidentRepository(db);
  const { ruleEngine, stepFactory } = createDefaultIncidentPipeline();
  const heartbeatService = new HeartbeatService(deviceRepo, incidentRepo, ruleEngine, stepFactory);

  // seed venues first — devices reference them via foreign key
  const venueIds = Array.from(
    { length: 8 },
    (_, i) => `sim-venue-${String(i + 1).padStart(2, '0')}`,
  );
  seedVenues(db, venueIds);

  // assign devices to venues in round-robin order
  const deviceIds = Array.from(
    { length: 30 },
    (_, i) => `sim-device-${String(i + 1).padStart(2, '0')}`,
  );
  const deviceVenueMap = new Map<string, string>();
  for (let i = 0; i < deviceIds.length; i++) {
    deviceVenueMap.set(deviceIds[i], venueIds[i % venueIds.length]);
  }

  // seeded prng — always the same sequence so incident patterns are reproducible
  const rand = mulberry32(42);

  let totalNew = 0;
  let totalResolved = 0;

  const totalSecs = Math.round((TOTAL_ROUNDS * ROUND_INTERVAL_MS) / 1000);
  console.log(`[sim] starting: 8 venues, 30 devices, ${TOTAL_ROUNDS} rounds (~${totalSecs}s)`);
  console.log(`[sim] failure phase: rounds ${FAILURE_START}–${FAILURE_END}`);
  console.log(`[sim] recovery phase: rounds ${RECOVERY_START}–${RECOVERY_END}`);

  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const inFailure = round >= FAILURE_START && round <= FAILURE_END;
    const inRecovery = round >= RECOVERY_START && round <= RECOVERY_END;

    for (let i = 0; i < deviceIds.length; i++) {
      const deviceId = deviceIds[i];
      const venueId = deviceVenueMap.get(deviceId) as string;
      const label = `Sim TV ${String(i + 1).padStart(2, '0')}`;

      const isOffline = inFailure && OFFLINE_INDICES.includes(i);
      const isWeakNet = inFailure && WEAK_NETWORK_INDICES.includes(i);
      const isNoRender = inFailure && NO_RENDER_INDICES.includes(i);
      const isDetectionStale = inFailure && DETECTION_STALE_INDICES.includes(i);

      if (isOffline) {
        // write a stale heartbeat timestamp directly so the offline rule fires
        const staleTs = nowSeconds - OFFLINE_THRESHOLD_SECONDS - 30;
        db.exec(
          `UPDATE devices SET last_heartbeat_at = ${staleTs} WHERE id = '${deviceId}'`,
        );
        // evaluate the stored device — this creates or keeps open the OFFLINE incident
        const r = evaluateStoredDevice(
          deviceId,
          deviceRepo,
          incidentRepo,
          ruleEngine,
          stepFactory,
          nowSeconds,
        );
        totalNew += r.newCount;
        totalResolved += r.resolvedCount;
        continue;
      }

      // choose telemetry based on which failure scenario applies this round
      const rssi = isWeakNet
        ? -85 - randBetween(rand, 0, 5)
        : -45 + randBetween(rand, 0, 10);

      const signal = isWeakNet ? 10 + randBetween(rand, 0, 5) : 70 + randBetween(rand, 0, 20);

      // no-render: lastRenderAt is far in the past (beyond the 300s threshold)
      const lastRenderAt = isNoRender
        ? nowSeconds - 400 - Math.floor(randBetween(rand, 0, 60))
        : nowSeconds - 60 - Math.floor(randBetween(rand, 0, 30));

      // detection-stale: pass null so the "never reported" branch fires immediately
      const lastDetectionAt = isDetectionStale
        ? null
        : nowSeconds - 60 - Math.floor(randBetween(rand, 0, 30));

      const result = heartbeatService.handleHeartbeat({
        deviceId,
        venueId,
        label,
        lastRenderAt,
        lastDetectionAt,
        signalStrengthPercent: Math.round(signal),
        rssiDbm: Math.round(rssi),
        firmwareVersion: '2.1.4',
      });

      totalNew += result.newIncidents.length;
      totalResolved += result.resolvedIncidents.length;
    }

    // during recovery, also send healthy heartbeats for offline devices so they resolve
    if (inRecovery) {
      for (const i of OFFLINE_INDICES) {
        const deviceId = deviceIds[i];
        const venueId = deviceVenueMap.get(deviceId) as string;
        const result = heartbeatService.handleHeartbeat({
          deviceId,
          venueId,
          label: `Sim TV ${String(i + 1).padStart(2, '0')}`,
          lastRenderAt: nowSeconds - 60,
          lastDetectionAt: nowSeconds - 60,
          signalStrengthPercent: 80,
          rssiDbm: -42,
          firmwareVersion: '2.1.4',
        });
        totalNew += result.newIncidents.length;
        totalResolved += result.resolvedIncidents.length;
      }
    }

    if (round % 5 === 0) {
      console.log(`[sim] round ${round}/${TOTAL_ROUNDS} — new: +${totalNew} resolved: +${totalResolved}`);
    }

    if (round < TOTAL_ROUNDS) {
      await sleep(ROUND_INTERVAL_MS);
    }
  }

  // print final summary
  const allDevices = deviceRepo.findAll();
  const statusCounts: Record<string, number> = {};
  for (const d of allDevices) {
    statusCounts[d.status] = (statusCounts[d.status] ?? 0) + 1;
  }

  const allIncidents = incidentRepo.listWithFilters({
    onlyActive: false,
    limit: 10000,
    offset: 0,
  });

  console.log('\n[sim] === simulation complete ===');
  console.log(`[sim] total devices in db:       ${allDevices.length}`);
  console.log(`[sim] device status breakdown:   ${JSON.stringify(statusCounts)}`);
  console.log(`[sim] incidents created this run: ${totalNew}`);
  console.log(`[sim] incidents resolved this run: ${totalResolved}`);
  console.log(`[sim] total incidents in db:      ${allIncidents.total}`);

  closeDatabase(db);
}

// run and surface any top-level errors
runSimulation().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[sim] fatal error:', message);
  process.exit(1);
});
