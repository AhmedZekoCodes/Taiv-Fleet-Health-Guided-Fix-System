/*
these tests verify that the offline rule fires only when heartbeat silence exceeds the threshold.
*/

import { OfflineRule } from '../../rules/OfflineRule';
import { IncidentType } from '../../domain/enums';
import { OFFLINE_THRESHOLD_SECONDS } from '../../domain/constants';
import { makeDevice } from '../helpers/deviceFactory';

describe('OfflineRule', () => {
  const rule = new OfflineRule();
  // the device last sent a heartbeat at t=1000000
  const LAST_HEARTBEAT = 1_000_000;

  it('returns null when heartbeat is recent', () => {
    const device = makeDevice({}, { lastHeartbeatAt: LAST_HEARTBEAT });
    // nowSeconds is just inside the threshold
    const now = LAST_HEARTBEAT + OFFLINE_THRESHOLD_SECONDS - 1;
    const result = rule.evaluate({ device, nowSeconds: now });
    expect(result).toBeNull();
  });

  it('returns null exactly at the threshold boundary', () => {
    const device = makeDevice({}, { lastHeartbeatAt: LAST_HEARTBEAT });
    const now = LAST_HEARTBEAT + OFFLINE_THRESHOLD_SECONDS;
    const result = rule.evaluate({ device, nowSeconds: now });
    expect(result).toBeNull();
  });

  it('returns a match when heartbeat is overdue by one second', () => {
    const device = makeDevice({}, { lastHeartbeatAt: LAST_HEARTBEAT });
    const now = LAST_HEARTBEAT + OFFLINE_THRESHOLD_SECONDS + 1;
    const result = rule.evaluate({ device, nowSeconds: now });
    expect(result).not.toBeNull();
    expect(result?.type).toBe(IncidentType.OFFLINE);
  });

  it('includes the correct context values in the match', () => {
    const device = makeDevice({}, { lastHeartbeatAt: LAST_HEARTBEAT });
    const overdueby = 200;
    const now = LAST_HEARTBEAT + OFFLINE_THRESHOLD_SECONDS + overdueby;
    const result = rule.evaluate({ device, nowSeconds: now });

    expect(result?.context).toMatchObject({
      lastHeartbeatAt: LAST_HEARTBEAT,
      thresholdSeconds: OFFLINE_THRESHOLD_SECONDS,
    });
    // the seconds since heartbeat should reflect the full elapsed time
    expect(result?.context.secondsSinceHeartbeat).toBe(
      OFFLINE_THRESHOLD_SECONDS + overdueby,
    );
  });

  it('generates troubleshooting steps with correct order', () => {
    const device = makeDevice();
    const match = {
      type: IncidentType.OFFLINE,
      summary: 'test',
      context: {},
    };
    const steps = rule.buildTroubleshootingSteps(match, device);
    expect(steps.length).toBeGreaterThan(0);
    steps.forEach((step, index) => {
      expect(step.order).toBe(index + 1);
    });
  });

  it('has OFFLINE as its rule type', () => {
    expect(rule.type).toBe(IncidentType.OFFLINE);
  });
});
