/*
these tests verify the detection stale rule fires when commercial break detection stops.
*/

import { DetectionStaleRule } from '../../rules/DetectionStaleRule';
import { IncidentType } from '../../domain/enums';
import {
  DETECTION_STALE_THRESHOLD_SECONDS,
  OFFLINE_THRESHOLD_SECONDS,
} from '../../domain/constants';
import { makeDevice } from '../helpers/deviceFactory';

describe('DetectionStaleRule', () => {
  const rule = new DetectionStaleRule();
  const BASE_TIME = 1_000_000;

  it('returns null when the device is detecting normally', () => {
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        lastDetectionAt: BASE_TIME,
      },
    );
    const now = BASE_TIME + DETECTION_STALE_THRESHOLD_SECONDS - 1;
    expect(rule.evaluate({ device, nowSeconds: now })).toBeNull();
  });

  it('returns null when the device is offline', () => {
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        lastDetectionAt: null,
      },
    );
    const now = BASE_TIME + OFFLINE_THRESHOLD_SECONDS + 1;
    expect(rule.evaluate({ device, nowSeconds: now })).toBeNull();
  });

  it('returns a match when detection has never been seen on an online device', () => {
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        lastDetectionAt: null,
      },
    );
    const now = BASE_TIME + 10;
    const result = rule.evaluate({ device, nowSeconds: now });
    expect(result).not.toBeNull();
    expect(result?.type).toBe(IncidentType.DETECTION_STALE);
  });

  it('returns a match when detection has been silent past the threshold', () => {
    const STALE_DETECTION = BASE_TIME - DETECTION_STALE_THRESHOLD_SECONDS - 1;
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        lastDetectionAt: STALE_DETECTION,
      },
    );
    const now = BASE_TIME + 10;
    const result = rule.evaluate({ device, nowSeconds: now });
    expect(result).not.toBeNull();
    expect(result?.type).toBe(IncidentType.DETECTION_STALE);
  });

  it('returns null when detection is exactly at the threshold boundary', () => {
    const LAST_DETECTION = BASE_TIME - DETECTION_STALE_THRESHOLD_SECONDS;
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        lastDetectionAt: LAST_DETECTION,
      },
    );
    // nowSeconds = BASE_TIME so elapsed = threshold exactly
    expect(rule.evaluate({ device, nowSeconds: BASE_TIME })).toBeNull();
  });

  it('generates steps in sequential order', () => {
    const device = makeDevice();
    const match = { type: IncidentType.DETECTION_STALE, summary: '', context: {} };
    const steps = rule.buildTroubleshootingSteps(match, device);
    steps.forEach((step, i) => expect(step.order).toBe(i + 1));
  });
});
