/*
this rule checks if a device has a poor wifi or network signal.
a weak signal causes intermittent connectivity issues that are hard to diagnose remotely.
*/

import { IncidentRule, RuleEvaluationContext, RuleMatch } from './IncidentRule';
import { Device } from '../domain/Device';
import { Incident } from '../domain/Incident';
import { IncidentType, SeverityLevel } from '../domain/enums';
import {
  WEAK_NETWORK_RSSI_THRESHOLD_DBM,
  WEAK_NETWORK_SIGNAL_PERCENT_THRESHOLD,
  OFFLINE_THRESHOLD_SECONDS,
} from '../domain/constants';

export class WeakNetworkRule implements IncidentRule {
  readonly type = IncidentType.WEAK_NETWORK;

  evaluate(ctx: RuleEvaluationContext): RuleMatch | null {
    const { device, nowSeconds } = ctx;
    const secondsSinceHeartbeat = nowSeconds - device.telemetry.lastHeartbeatAt;

    // only flag network issues for devices that are still online
    if (secondsSinceHeartbeat > OFFLINE_THRESHOLD_SECONDS) {
      return null;
    }

    const { signalStrengthPercent, rssiDbm } = device.telemetry;

    // we need at least one signal metric to evaluate network health
    if (signalStrengthPercent === null && rssiDbm === null) {
      return null;
    }

    const weakByPercent =
      signalStrengthPercent !== null &&
      signalStrengthPercent < WEAK_NETWORK_SIGNAL_PERCENT_THRESHOLD;

    const weakByRssi =
      rssiDbm !== null && rssiDbm < WEAK_NETWORK_RSSI_THRESHOLD_DBM;

    if (!weakByPercent && !weakByRssi) {
      return null;
    }

    return {
      type: this.type,
      summary: `Device "${device.label}" has a weak network signal (${signalStrengthPercent ?? 'N/A'}% / ${rssiDbm ?? 'N/A'} dBm).`,
      context: {
        signalStrengthPercent,
        rssiDbm,
        signalPercentThreshold: WEAK_NETWORK_SIGNAL_PERCENT_THRESHOLD,
        rssiThresholdDbm: WEAK_NETWORK_RSSI_THRESHOLD_DBM,
      },
    };
  }

  buildTroubleshootingSteps(
    _match: RuleMatch,
    device: Device,
  ): Incident['troubleshootingSteps'] {
    return [
      {
        order: 1,
        title: 'Check physical distance from router',
        description: `Measure the distance between "${device.label}" and the nearest wifi access point. Walls and interference reduce signal quickly.`,
        requiresConfirmation: false,
      },
      {
        order: 2,
        title: 'Try switching to ethernet',
        description: 'If a wired connection is possible, connect the taiv box directly with an ethernet cable for a stable link.',
        requiresConfirmation: true,
      },
      {
        order: 3,
        title: 'Reposition the router or add an access point',
        description: 'Work with the venue to reposition the router or install a wifi extender closer to the TV.',
        requiresConfirmation: false,
      },
      {
        order: 4,
        title: 'Verify router channel',
        description: 'Check if the router is using a congested wifi channel. Switching to a less busy channel may improve signal.',
        requiresConfirmation: false,
      },
      {
        order: 5,
        title: 'Monitor signal after changes',
        description: 'After any adjustments, monitor the signal strength over the next hour to confirm improvement.',
        requiresConfirmation: false,
      },
    ];
  }

  static readonly severity = SeverityLevel.LOW;
}
