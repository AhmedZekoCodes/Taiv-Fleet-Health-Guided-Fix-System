/*
this rule checks if the device stopped rendering ads or content.
a device can be online but still fail to show anything, which hurts revenue.
*/

import { IncidentRule, RuleEvaluationContext, RuleMatch } from './IncidentRule';
import { Device } from '../domain/Device';
import { Incident } from '../domain/Incident';
import { IncidentType, SeverityLevel } from '../domain/enums';
import { NO_RENDER_THRESHOLD_SECONDS, OFFLINE_THRESHOLD_SECONDS } from '../domain/constants';

export class NoRenderRule implements IncidentRule {
  readonly type = IncidentType.NO_RENDER;
  readonly severity = SeverityLevel.HIGH;

  evaluate(ctx: RuleEvaluationContext): RuleMatch | null {
    const { device, nowSeconds } = ctx;
    const secondsSinceHeartbeat = nowSeconds - device.telemetry.lastHeartbeatAt;

    // skip this check if the device is already offline — the offline rule covers it
    if (secondsSinceHeartbeat > OFFLINE_THRESHOLD_SECONDS) {
      return null;
    }

    // if we have never received a render timestamp, treat it as not rendering
    const lastRenderAt = device.telemetry.lastRenderAt;
    if (lastRenderAt === null) {
      return {
        type: this.type,
        severity: this.severity,
        summary: `Device "${device.label}" has never reported a render event.`,
        context: {
          lastRenderAt: null,
          thresholdSeconds: NO_RENDER_THRESHOLD_SECONDS,
        },
      };
    }

    const secondsSinceRender = nowSeconds - lastRenderAt;

    if (secondsSinceRender <= NO_RENDER_THRESHOLD_SECONDS) {
      return null;
    }

    return {
      type: this.type,
      severity: this.severity,
      summary: `Device "${device.label}" has not rendered any content in ${secondsSinceRender} seconds.`,
      context: {
        lastRenderAt,
        secondsSinceRender,
        thresholdSeconds: NO_RENDER_THRESHOLD_SECONDS,
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
        title: 'Confirm device is online',
        description: `Check that "${device.label}" is sending heartbeats and is not marked offline.`,
        requiresConfirmation: true,
      },
      {
        order: 2,
        title: 'Check content scheduling',
        description: 'Verify there is active content scheduled for this venue in the content management system.',
        requiresConfirmation: true,
      },
      {
        order: 3,
        title: 'Inspect the render service logs',
        description: 'SSH into the device and check the render service logs for errors or exceptions.',
        requiresConfirmation: false,
      },
      {
        order: 4,
        title: 'Restart render service',
        description: 'Run `sudo systemctl restart taiv-render` on the device to restart the rendering process.',
        requiresConfirmation: true,
      },
      {
        order: 5,
        title: 'Confirm render resumes',
        description: 'Wait 5 minutes and confirm the device reports a new render event.',
        requiresConfirmation: false,
      },
    ];
  }

}
