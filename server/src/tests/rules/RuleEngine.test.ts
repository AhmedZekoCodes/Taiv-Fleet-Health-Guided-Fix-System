/*
these tests verify that the rule engine runs all registered rules and collects matches correctly.
*/

import { RuleEngine } from '../../rules/RuleEngine';
import { OfflineRule } from '../../rules/OfflineRule';
import { NoRenderRule } from '../../rules/NoRenderRule';
import { DetectionStaleRule } from '../../rules/DetectionStaleRule';
import { WeakNetworkRule } from '../../rules/WeakNetworkRule';
import { createDefaultRuleEngine } from '../../rules/index';
import { IncidentType } from '../../domain/enums';
import {
  OFFLINE_THRESHOLD_SECONDS,
  NO_RENDER_THRESHOLD_SECONDS,
} from '../../domain/constants';
import { makeDevice } from '../helpers/deviceFactory';

describe('RuleEngine', () => {
  const BASE_TIME = 1_000_000;

  it('returns no matches for a healthy device', () => {
    const engine = createDefaultRuleEngine();
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        lastRenderAt: BASE_TIME,
        lastDetectionAt: BASE_TIME,
        signalStrengthPercent: 80,
        rssiDbm: -55,
      },
    );
    const result = engine.evaluate(device, BASE_TIME);
    expect(result.matches).toHaveLength(0);
  });

  it('returns an offline match for a device with a stale heartbeat', () => {
    const engine = createDefaultRuleEngine();
    const device = makeDevice({}, { lastHeartbeatAt: BASE_TIME });
    const now = BASE_TIME + OFFLINE_THRESHOLD_SECONDS + 10;
    const result = engine.evaluate(device, now);

    const offlineMatch = result.matches.find((m) => m.type === IncidentType.OFFLINE);
    expect(offlineMatch).toBeDefined();
  });

  it('fires multiple rules when multiple problems exist on an online device', () => {
    const engine = createDefaultRuleEngine();
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        // render is stale — online device not rendering
        lastRenderAt: BASE_TIME - NO_RENDER_THRESHOLD_SECONDS - 100,
        // network is weak
        signalStrengthPercent: 5,
        rssiDbm: -90,
        lastDetectionAt: BASE_TIME,
      },
    );
    const result = engine.evaluate(device, BASE_TIME);

    const types = result.matches.map((m) => m.type);
    expect(types).toContain(IncidentType.NO_RENDER);
    expect(types).toContain(IncidentType.WEAK_NETWORK);
  });

  it('includes all four default rule types when created with factory', () => {
    const engine = createDefaultRuleEngine();
    const types = engine.getRuleTypes();
    expect(types).toContain(IncidentType.OFFLINE);
    expect(types).toContain(IncidentType.NO_RENDER);
    expect(types).toContain(IncidentType.DETECTION_STALE);
    expect(types).toContain(IncidentType.WEAK_NETWORK);
  });

  it('only runs the rules that were registered', () => {
    // register only the offline rule — other problems should not be detected
    const engine = new RuleEngine([new OfflineRule()]);
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        // render is stale, signal is weak — but those rules are not registered
        lastRenderAt: BASE_TIME - NO_RENDER_THRESHOLD_SECONDS - 100,
        signalStrengthPercent: 5,
        rssiDbm: -90,
      },
    );
    const result = engine.evaluate(device, BASE_TIME);
    expect(result.matches).toHaveLength(0);
  });

  it('skips no-render and detection checks for offline devices', () => {
    const engine = new RuleEngine([
      new NoRenderRule(),
      new DetectionStaleRule(),
      new WeakNetworkRule(),
    ]);
    const device = makeDevice(
      {},
      {
        lastHeartbeatAt: BASE_TIME,
        lastRenderAt: null,
        lastDetectionAt: null,
        signalStrengthPercent: 5,
        rssiDbm: -90,
      },
    );
    // put nowSeconds far past the offline threshold
    const now = BASE_TIME + OFFLINE_THRESHOLD_SECONDS + 1;
    const result = engine.evaluate(device, now);

    // all three rules skip offline devices, so no matches expected
    expect(result.matches).toHaveLength(0);
  });
});
