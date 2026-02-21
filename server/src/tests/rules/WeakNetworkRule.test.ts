/*
these tests check that the weak network rule fires on bad signal values and stays silent on good ones.
*/

import { WeakNetworkRule } from '../../rules/WeakNetworkRule';
import { IncidentType, SeverityLevel } from '../../domain/enums';
import {
  WEAK_NETWORK_RSSI_THRESHOLD_DBM,
  WEAK_NETWORK_SIGNAL_PERCENT_THRESHOLD,
  OFFLINE_THRESHOLD_SECONDS,
} from '../../domain/constants';
import { makeDevice } from '../helpers/deviceFactory';

describe('WeakNetworkRule', () => {
  const rule = new WeakNetworkRule();
  const BASE_TIME = 1_000_000;

  it('returns null when signal strength is above both thresholds', () => {
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        signalStrengthPercent: WEAK_NETWORK_SIGNAL_PERCENT_THRESHOLD + 10,
        rssiDbm: WEAK_NETWORK_RSSI_THRESHOLD_DBM + 10,
      },
    );
    expect(rule.evaluate({ device, nowSeconds: BASE_TIME })).toBeNull();
  });

  it('returns null when no signal metrics are available', () => {
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        signalStrengthPercent: null,
        rssiDbm: null,
      },
    );
    expect(rule.evaluate({ device, nowSeconds: BASE_TIME })).toBeNull();
  });

  it('returns null when the device is offline', () => {
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        signalStrengthPercent: 5,
        rssiDbm: -90,
      },
    );
    const now = BASE_TIME + OFFLINE_THRESHOLD_SECONDS + 1;
    expect(rule.evaluate({ device, nowSeconds: now })).toBeNull();
  });

  it('returns a match when signal strength percent is below threshold', () => {
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        signalStrengthPercent: WEAK_NETWORK_SIGNAL_PERCENT_THRESHOLD - 1,
        rssiDbm: -50,
      },
    );
    const result = rule.evaluate({ device, nowSeconds: BASE_TIME });
    expect(result).not.toBeNull();
    expect(result?.type).toBe(IncidentType.WEAK_NETWORK);
  });

  it('returns a match when rssi is below threshold (more negative)', () => {
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        signalStrengthPercent: 80,
        rssiDbm: WEAK_NETWORK_RSSI_THRESHOLD_DBM - 1,
      },
    );
    const result = rule.evaluate({ device, nowSeconds: BASE_TIME });
    expect(result).not.toBeNull();
    expect(result?.type).toBe(IncidentType.WEAK_NETWORK);
  });

  it('includes signal values in the match context', () => {
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        signalStrengthPercent: 10,
        rssiDbm: -85,
      },
    );
    const result = rule.evaluate({ device, nowSeconds: BASE_TIME });
    expect(result?.context).toMatchObject({
      signalStrengthPercent: 10,
      rssiDbm: -85,
    });
  });

  it('generates steps in sequential order', () => {
    const device = makeDevice();
    const match = { type: IncidentType.WEAK_NETWORK, severity: SeverityLevel.LOW, summary: '', context: {} };
    const steps = rule.buildTroubleshootingSteps(match, device);
    steps.forEach((step, i) => expect(step.order).toBe(i + 1));
  });
});
