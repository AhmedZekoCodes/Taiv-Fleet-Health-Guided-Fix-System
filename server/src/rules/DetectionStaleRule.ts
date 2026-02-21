/*
this rule checks if the device stopped detecting commercial breaks.
if detection is frozen, the device cannot insert ads even if the render service is running.
*/

import { IncidentRule, RuleEvaluationContext, RuleMatch } from './IncidentRule';
import { Device } from '../domain/Device';
import { Incident } from '../domain/Incident';
import { IncidentType, SeverityLevel } from '../domain/enums';
import {
  DETECTION_STALE_THRESHOLD_SECONDS,
  OFFLINE_THRESHOLD_SECONDS,
} from '../domain/constants';

export class DetectionStaleRule implements IncidentRule {
  readonly type = IncidentType.DETECTION_STALE;
  readonly severity = SeverityLevel.MEDIUM;

  evaluate(ctx: RuleEvaluationContext): RuleMatch | null {
    const { device, nowSeconds } = ctx;
    const secondsSinceHeartbeat = nowSeconds - device.telemetry.lastHeartbeatAt;

    // only check detection if the device is actually online
    if (secondsSinceHeartbeat > OFFLINE_THRESHOLD_SECONDS) {
      return null;
    }

    const lastDetectionAt = device.telemetry.lastDetectionAt;

    // if we have never seen a detection event, that itself is suspicious
    if (lastDetectionAt === null) {
      return {
        type: this.type,
        severity: this.severity,
        summary: `Device "${device.label}" has never reported a commercial detection event.`,
        context: {
          lastDetectionAt: null,
          thresholdSeconds: DETECTION_STALE_THRESHOLD_SECONDS,
        },
      };
    }

    const secondsSinceDetection = nowSeconds - lastDetectionAt;

    if (secondsSinceDetection <= DETECTION_STALE_THRESHOLD_SECONDS) {
      return null;
    }

    return {
      type: this.type,
      severity: this.severity,
      summary: `Device "${device.label}" has not detected a commercial break in ${secondsSinceDetection} seconds.`,
      context: {
        lastDetectionAt,
        secondsSinceDetection,
        thresholdSeconds: DETECTION_STALE_THRESHOLD_SECONDS,
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
        title: 'Verify the broadcast feed',
        description: `Confirm the TV connected to "${device.label}" is actively playing live broadcast TV, not a streaming app or static input.`,
        requiresConfirmation: true,
      },
      {
        order: 2,
        title: 'Check audio capture hardware',
        description: 'Confirm the audio capture cable is connected between the TV and the taiv box.',
        requiresConfirmation: true,
      },
      {
        order: 3,
        title: 'Inspect detection service logs',
        description: 'SSH into the device and check `journalctl -u taiv-detect` for errors.',
        requiresConfirmation: false,
      },
      {
        order: 4,
        title: 'Restart detection service',
        description: 'Run `sudo systemctl restart taiv-detect` and monitor for new detection events.',
        requiresConfirmation: true,
      },
      {
        order: 5,
        title: 'Flag for model review if persistent',
        description: 'If detection does not resume after the restart, flag this device for a detection model review.',
        requiresConfirmation: false,
      },
    ];
  }

}
