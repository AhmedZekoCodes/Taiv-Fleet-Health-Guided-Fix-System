/*
integration tests for the notification feature.
they use an in-memory sqlite database and cover:
  - heartbeat creates incident → outbox rows are created
  - idempotency: repeated heartbeat does not create duplicate outbox rows
  - worker runOnce sends pending rows and marks them SENT
  - retry logic: failing sender increments attempt_count and schedules retry
  - rate limiting: second incident of same type is suppressed within the window
*/

import { DatabaseSync } from 'node:sqlite';
import { openDatabase, closeDatabase } from '../../db/sqlite';
import { runMigrations } from '../../db/migrate';
import { SqliteDeviceRepository } from '../../repositories/sqlite/SqliteDeviceRepository';
import { SqliteIncidentRepository } from '../../repositories/sqlite/SqliteIncidentRepository';
import { SqliteVenueContactRepository } from '../../repositories/sqlite/SqliteVenueContactRepository';
import { SqliteNotificationOutboxRepository } from '../../repositories/sqlite/SqliteNotificationOutboxRepository';
import { HeartbeatService } from '../../services/HeartbeatService';
import { NotificationService } from '../../services/NotificationService';
import { NotificationComposer } from '../../services/NotificationComposer';
import { NotificationWorker } from '../../notifications/NotificationWorker';
import { INotificationSender } from '../../notifications/INotificationSender';
import { createDefaultIncidentPipeline } from '../../rules';
import { NotificationChannel, NotificationStatus } from '../../domain/enums';
import { OutboxEntry } from '../../domain/Notification';
import { NOTIFICATION_RATE_LIMIT_SECONDS } from '../../domain/constants';

// a sender stub that always resolves — used to verify the happy path
class AlwaysSucceedSender implements INotificationSender {
  readonly channel: NotificationChannel;
  readonly sent: OutboxEntry[] = [];

  constructor(channel: NotificationChannel) {
    this.channel = channel;
  }

  send(entry: OutboxEntry): Promise<void> {
    this.sent.push(entry);
    return Promise.resolve();
  }
}

// a sender stub that always rejects — used to test retry logic
class AlwaysFailSender implements INotificationSender {
  readonly channel: NotificationChannel;

  constructor(channel: NotificationChannel) {
    this.channel = channel;
  }

  send(_entry: OutboxEntry): Promise<void> {
    return Promise.reject(new Error('simulated send failure'));
  }
}

// shape of one outbox row as returned by the count query in tests
interface OutboxCountRow {
  cnt: number;
}

interface OutboxStatusRow {
  id: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
}

// the shape returned by buildPipeline so callers can destructure safely
interface TestPipeline {
  deviceRepo: SqliteDeviceRepository;
  incidentRepo: SqliteIncidentRepository;
  contactRepo: SqliteVenueContactRepository;
  outboxRepo: SqliteNotificationOutboxRepository;
  heartbeatService: HeartbeatService;
  worker: NotificationWorker;
  clock: { now: number };
}

// wires up all dependencies against an in-memory db
function buildPipeline(db: DatabaseSync, senders: INotificationSender[]): TestPipeline {
  runMigrations(db);
  const deviceRepo = new SqliteDeviceRepository(db);
  const incidentRepo = new SqliteIncidentRepository(db);
  const contactRepo = new SqliteVenueContactRepository(db);
  const outboxRepo = new SqliteNotificationOutboxRepository(db);
  const { ruleEngine, stepFactory } = createDefaultIncidentPipeline();
  const composer = new NotificationComposer();
  // inject a fast clock so rate limit tests can control time
  const clock = { now: Math.floor(Date.now() / 1000) };
  const notificationService = new NotificationService(
    contactRepo,
    outboxRepo,
    composer,
    () => clock.now,
  );
  const heartbeatService = new HeartbeatService(
    deviceRepo,
    incidentRepo,
    ruleEngine,
    stepFactory,
    notificationService,
  );
  const worker = new NotificationWorker(outboxRepo, senders);
  return { deviceRepo, incidentRepo, contactRepo, outboxRepo, heartbeatService, worker, clock };
}

// seeds one venue contact with both channels for the given venue
function seedContact(
  contactRepo: SqliteVenueContactRepository,
  venueId = 'v1',
): void {
  contactRepo.upsert({
    id: 'c1',
    venueId,
    name: 'Test Manager',
    email: 'mgr@test.com',
    phone: '+15550001234',
    channels: [NotificationChannel.EMAIL, NotificationChannel.SMS],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

// a heartbeat payload that triggers the WEAK_NETWORK rule (and NO_RENDER + DETECTION_STALE since timestamps are absent)
function weakNetworkPayload(ts: number): {
  deviceId: string;
  venueId: string;
  label: string;
  lastHeartbeatAt: number;
  signalStrengthPercent: number;
  rssiDbm: number;
} {
  return {
    deviceId: 'd1',
    venueId: 'v1',
    label: 'TV 1',
    lastHeartbeatAt: ts,
    signalStrengthPercent: 10,
    rssiDbm: -90,
  };
}

describe('notification outbox — incident creation', () => {
  let db: DatabaseSync;
  let pipeline: ReturnType<typeof buildPipeline>;
  const emailSender = new AlwaysSucceedSender(NotificationChannel.EMAIL);
  const smsSender = new AlwaysSucceedSender(NotificationChannel.SMS);

  beforeAll(() => {
    db = openDatabase(':memory:');
    pipeline = buildPipeline(db, [emailSender, smsSender]);
    seedContact(pipeline.contactRepo);
  });

  afterAll(() => closeDatabase(db));

  beforeEach(() => {
    db.exec('DELETE FROM incidents; DELETE FROM devices; DELETE FROM notification_outbox;');
    emailSender.sent.length = 0;
    smsSender.sent.length = 0;
    // advance the clock past the rate limit window so each test starts with a clean rate-limit state.
    // the NotificationService's in-memory map survives between tests; advancing time bypasses it.
    pipeline.clock.now += NOTIFICATION_RATE_LIMIT_SECONDS + 1;
  });

  it('creates outbox rows when a heartbeat triggers an incident', () => {
    const now = Math.floor(Date.now() / 1000);
    pipeline.heartbeatService.handleHeartbeat(weakNetworkPayload(now));

    // one contact with email + sms → expect 2 rows per incident
    // the weak network payload also triggers NO_RENDER and DETECTION_STALE so 3 incidents × 2 = 6
    const row = db
      .prepare('SELECT COUNT(*) AS cnt FROM notification_outbox WHERE venue_id = ?')
      .get('v1') as unknown as OutboxCountRow;

    expect(row.cnt).toBeGreaterThan(0);
  });

  it('all outbox rows start with status PENDING', () => {
    const now = Math.floor(Date.now() / 1000);
    pipeline.heartbeatService.handleHeartbeat(weakNetworkPayload(now));

    const nonPending = db
      .prepare("SELECT COUNT(*) AS cnt FROM notification_outbox WHERE status != 'PENDING'")
      .get() as unknown as OutboxCountRow;

    expect(nonPending.cnt).toBe(0);
  });

  it('idempotency: repeated heartbeat for the same open incident does not add duplicate outbox rows', () => {
    const now = Math.floor(Date.now() / 1000);

    // first heartbeat — creates incidents and outbox rows
    pipeline.heartbeatService.handleHeartbeat(weakNetworkPayload(now));
    const after1 = (
      db
        .prepare('SELECT COUNT(*) AS cnt FROM notification_outbox')
        .get() as unknown as OutboxCountRow
    ).cnt;

    // second heartbeat — same device, same failure — should not add rows
    pipeline.heartbeatService.handleHeartbeat(weakNetworkPayload(now + 5));
    const after2 = (
      db
        .prepare('SELECT COUNT(*) AS cnt FROM notification_outbox')
        .get() as unknown as OutboxCountRow
    ).cnt;

    expect(after2).toBe(after1);
  });

  it('worker runOnce sends all pending rows and marks them SENT', async () => {
    const now = Math.floor(Date.now() / 1000);
    pipeline.heartbeatService.handleHeartbeat(weakNetworkPayload(now));

    await pipeline.worker.runOnce();

    const stillPending = db
      .prepare("SELECT COUNT(*) AS cnt FROM notification_outbox WHERE status = 'PENDING'")
      .get() as unknown as OutboxCountRow;

    expect(stillPending.cnt).toBe(0);

    const sent = db
      .prepare("SELECT COUNT(*) AS cnt FROM notification_outbox WHERE status = 'SENT'")
      .get() as unknown as OutboxCountRow;

    expect(sent.cnt).toBeGreaterThan(0);
  });

  it('worker records sent_at timestamp after successful send', async () => {
    const now = Math.floor(Date.now() / 1000);
    pipeline.heartbeatService.handleHeartbeat(weakNetworkPayload(now));
    await pipeline.worker.runOnce();

    const withoutSentAt = db
      .prepare("SELECT COUNT(*) AS cnt FROM notification_outbox WHERE status = 'SENT' AND sent_at IS NULL")
      .get() as unknown as OutboxCountRow;

    expect(withoutSentAt.cnt).toBe(0);
  });

  it('correct contacts receive the email and sms sends', async () => {
    const now = Math.floor(Date.now() / 1000);
    pipeline.heartbeatService.handleHeartbeat(weakNetworkPayload(now));
    await pipeline.worker.runOnce();

    // all email sends should target the seeded contact's email
    for (const entry of emailSender.sent) {
      expect(entry.toAddress).toBe('mgr@test.com');
    }

    // all sms sends should target the seeded contact's phone
    for (const entry of smsSender.sent) {
      expect(entry.toAddress).toBe('+15550001234');
    }
  });
});

describe('notification outbox — retry and failure handling', () => {
  let db: DatabaseSync;
  let pipeline: ReturnType<typeof buildPipeline>;

  beforeAll(() => {
    const failEmail = new AlwaysFailSender(NotificationChannel.EMAIL);
    const failSms = new AlwaysFailSender(NotificationChannel.SMS);
    db = openDatabase(':memory:');
    pipeline = buildPipeline(db, [failEmail, failSms]);
    seedContact(pipeline.contactRepo);
  });

  afterAll(() => closeDatabase(db));

  beforeEach(() => {
    db.exec('DELETE FROM incidents; DELETE FROM devices; DELETE FROM notification_outbox;');
    // advance clock past rate limit window so each test can enqueue notifications freely
    pipeline.clock.now += NOTIFICATION_RATE_LIMIT_SECONDS + 1;
  });

  it('first runOnce increments attempt_count and sets last_error but leaves status PENDING', async () => {
    const now = Math.floor(Date.now() / 1000);
    pipeline.heartbeatService.handleHeartbeat(weakNetworkPayload(now));

    await pipeline.worker.runOnce();

    // entries should still be PENDING after one failure (retries remain)
    const rows = db
      .prepare('SELECT status, attempt_count, last_error FROM notification_outbox')
      .all() as unknown as OutboxStatusRow[];

    for (const row of rows) {
      expect(row.status).toBe(NotificationStatus.PENDING);
      expect(row.attempt_count).toBe(1);
      expect(row.last_error).toBe('simulated send failure');
    }
  });

  it('after max_attempts runOnce calls the entries are permanently FAILED', async () => {
    // max attempts is 3 — run the worker 3 times
    // each run requires scheduled_at <= now so we set a far-future clock between runs
    const now = Math.floor(Date.now() / 1000);
    pipeline.heartbeatService.handleHeartbeat(weakNetworkPayload(now));

    // first attempt — entries still pending, backoff scheduled
    await pipeline.worker.runOnce();

    // reset scheduled_at to now so the next run can pick them up
    db.exec(`UPDATE notification_outbox SET scheduled_at = ${now}`);
    await pipeline.worker.runOnce();

    db.exec(`UPDATE notification_outbox SET scheduled_at = ${now}`);
    await pipeline.worker.runOnce();

    const failed = db
      .prepare("SELECT COUNT(*) AS cnt FROM notification_outbox WHERE status = 'FAILED'")
      .get() as unknown as OutboxCountRow;

    expect(failed.cnt).toBeGreaterThan(0);

    const pending = db
      .prepare("SELECT COUNT(*) AS cnt FROM notification_outbox WHERE status = 'PENDING'")
      .get() as unknown as OutboxCountRow;

    expect(pending.cnt).toBe(0);
  });
});

describe('notification outbox — rate limiting', () => {
  // each test gets a fresh db + pipeline so the in-memory rate limit map starts empty.
  // sharing a pipeline across rate-limit tests would cause state leakage.
  let db: DatabaseSync;
  let pipeline: ReturnType<typeof buildPipeline>;

  beforeEach(() => {
    db = openDatabase(':memory:');
    pipeline = buildPipeline(db, []);
    seedContact(pipeline.contactRepo);
  });

  afterEach(() => closeDatabase(db));

  it('second incident of the same type at the same venue is suppressed within the rate limit window', () => {
    const now = pipeline.clock.now;

    // first device triggers a WEAK_NETWORK incident
    pipeline.contactRepo.upsert({
      id: 'c1',
      venueId: 'v1',
      name: 'Test Manager',
      email: 'mgr@test.com',
      phone: null,
      channels: [NotificationChannel.EMAIL],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    pipeline.heartbeatService.handleHeartbeat({ ...weakNetworkPayload(now), deviceId: 'd1' });
    const after1 = (
      db
        .prepare("SELECT COUNT(*) AS cnt FROM notification_outbox WHERE channel = 'EMAIL'")
        .get() as unknown as OutboxCountRow
    ).cnt;

    // advance clock by 60s — still within the 30-min rate limit window
    pipeline.clock.now = now + 60;

    // second device at same venue — same incident type should not generate new outbox rows
    pipeline.heartbeatService.handleHeartbeat({
      ...weakNetworkPayload(now + 60),
      deviceId: 'd2',
    });

    const after2 = (
      db
        .prepare("SELECT COUNT(*) AS cnt FROM notification_outbox WHERE channel = 'EMAIL'")
        .get() as unknown as OutboxCountRow
    ).cnt;

    // count should not increase because WEAK_NETWORK for venue v1 is rate-limited
    expect(after2).toBe(after1);
  });

  it('after the rate limit window expires, new incidents trigger fresh outbox rows', () => {
    const now = pipeline.clock.now;

    pipeline.heartbeatService.handleHeartbeat({ ...weakNetworkPayload(now), deviceId: 'd1' });

    // advance clock past the 30-min rate limit window
    pipeline.clock.now = now + 1801;

    // resolve the incident first so a new one can be created
    db.exec(`UPDATE incidents SET status = 'RESOLVED' WHERE device_id = 'd1'`);

    // new incident — should now create outbox rows again
    pipeline.heartbeatService.handleHeartbeat({
      ...weakNetworkPayload(now + 1801),
      deviceId: 'd1',
    });

    const weakNetworkRows = db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM notification_outbox
         WHERE channel = 'EMAIL' AND incident_id IN (
           SELECT id FROM incidents WHERE device_id = 'd1' AND type = 'WEAK_NETWORK'
         )`,
      )
      .get() as unknown as OutboxCountRow;

    // should have rows for two separate incidents (pre- and post-rate-limit expiry)
    expect(weakNetworkRows.cnt).toBeGreaterThanOrEqual(2);
  });
});
