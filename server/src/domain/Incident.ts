/*
this represents a problem that was detected on a device.
incidents are created by the rule engine and drive the troubleshooting flow.
*/

import { IncidentType, SeverityLevel, IncidentStatus } from './enums';

// a single step in the guided fix flow shown to support staff
export interface TroubleshootingStep {
  // order of this step in the sequence (1-indexed)
  order: number;
  title: string;
  description: string;
  // whether the support agent needs to confirm this step is done
  requiresConfirmation: boolean;
}

export interface Incident {
  id: string;
  deviceId: string;
  venueId: string;
  type: IncidentType;
  severity: SeverityLevel;
  status: IncidentStatus;
  // human-readable summary of what went wrong
  summary: string;
  // the telemetry values that triggered this incident, stored for context
  context: Record<string, unknown>;
  // ordered list of steps for the support agent to follow
  troubleshootingSteps: TroubleshootingStep[];
  detectedAt: Date;
  resolvedAt: Date | null;
  updatedAt: Date;
}
