/*
this rule checks if a device has stopped sending heartbeats.
if the last heartbeat is too old, the device is treated as offline.
*/

import { IncidentRule, RuleEvaluationContext, RuleMatch } from './IncidentRule';
import { Device } from '../domain/Device';
import { Incident } from '../domain/Incident';
import { IncidentType, SeverityLevel } from '../domain/enums';
import { OFFLINE_THRESHOLD_SECONDS } from '../domain/constants';

export class OfflineRule implements IncidentRule {
  readonly type = IncidentType.OFFLINE;

  evaluate(ctx: RuleEvaluationContext): RuleMatch | null {
    const { device, nowSeconds } = ctx;
    const secondsSinceHeartbeat = nowSeconds - device.telemetry.lastHeartbeatAt;

    // device is considered offline only if silence exceeds the threshold
    if (secondsSinceHeartbeat <= OFFLINE_THRESHOLD_SECONDS) {
      return null;
    }

    return {
      type: this.type,
      summary: `Device "${device.label}" has not sent a heartbeat in ${secondsSinceHeartbeat} seconds.`,
      context: {
        lastHeartbeatAt: device.telemetry.lastHeartbeatAt,
        secondsSinceHeartbeat,
        thresholdSeconds: OFFLINE_THRESHOLD_SECONDS,
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
        title: 'Check physical power',
        description: `Confirm the TV box labeled "${device.label}" is powered on and the power cable is secure.`,
        requiresConfirmation: true,
      },
      {
        order: 2,
        title: 'Check network connection',
        description: 'Verify the ethernet cable or wifi adapter is connected and the router is online.',
        requiresConfirmation: true,
      },
      {
        order: 3,
        title: 'Reboot the device',
        description: 'Unplug the power cable, wait 10 seconds, then plug it back in.',
        requiresConfirmation: true,
      },
      {
        order: 4,
        title: 'Wait for reconnection',
        description: 'Allow up to 2 minutes for the device to reconnect and send a heartbeat.',
        requiresConfirmation: false,
      },
      {
        order: 5,
        title: 'Escalate if still offline',
        description: 'If the device does not come back online after the reboot, escalate to a field technician visit.',
        requiresConfirmation: false,
      },
    ];
  }

  // expose the severity so callers can stamp the incident correctly
  static readonly severity = SeverityLevel.CRITICAL;
}
