/*
these tests verify the no-render rule fires only when a device is online but not rendering.
*/

import { NoRenderRule } from '../../rules/NoRenderRule';
import { IncidentType } from '../../domain/enums';
import {
  NO_RENDER_THRESHOLD_SECONDS,
  OFFLINE_THRESHOLD_SECONDS,
} from '../../domain/constants';
import { makeDevice } from '../helpers/deviceFactory';

describe('NoRenderRule', () => {
  const rule = new NoRenderRule();
  const BASE_TIME = 1_000_000;

  it('returns null when the device is online and rendered recently', () => {
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        lastRenderAt: BASE_TIME,
      },
    );
    const now = BASE_TIME + NO_RENDER_THRESHOLD_SECONDS - 1;
    expect(rule.evaluate({ device, nowSeconds: now })).toBeNull();
  });

  it('returns null when the device is offline (offline rule handles it)', () => {
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        lastRenderAt: null,
      },
    );
    // put the time far past the offline threshold so the device is considered offline
    const now = BASE_TIME + OFFLINE_THRESHOLD_SECONDS + 1;
    expect(rule.evaluate({ device, nowSeconds: now })).toBeNull();
  });

  it('returns a match when the device is online but render is null', () => {
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        lastRenderAt: null,
      },
    );
    // the device is online (heartbeat is fresh)
    const now = BASE_TIME + 30;
    const result = rule.evaluate({ device, nowSeconds: now });
    expect(result).not.toBeNull();
    expect(result?.type).toBe(IncidentType.NO_RENDER);
  });

  it('returns a match when render has been silent past the threshold', () => {
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        lastRenderAt: BASE_TIME - NO_RENDER_THRESHOLD_SECONDS - 10,
      },
    );
    // nowSeconds is close to the heartbeat so the device is still online
    const now = BASE_TIME + 30;
    const result = rule.evaluate({ device, nowSeconds: now });
    expect(result).not.toBeNull();
    expect(result?.type).toBe(IncidentType.NO_RENDER);
  });

  it('returns null when render silence is exactly at the threshold', () => {
    const LAST_RENDER = BASE_TIME - NO_RENDER_THRESHOLD_SECONDS;
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        lastRenderAt: LAST_RENDER,
      },
    );
    // nowSeconds equals BASE_TIME so elapsed render time equals the threshold exactly
    expect(rule.evaluate({ device, nowSeconds: BASE_TIME })).toBeNull();
  });

  it('generates steps in sequential order', () => {
    const device = makeDevice();
    const match = { type: IncidentType.NO_RENDER, summary: '', context: {} };
    const steps = rule.buildTroubleshootingSteps(match, device);
    steps.forEach((step, i) => expect(step.order).toBe(i + 1));
  });
});
