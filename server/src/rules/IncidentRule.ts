/*
this is the contract every incident detection rule must follow.
using an interface here means we can add new rules later without touching the engine.
*/

import { Device } from '../domain/Device';
import { Incident } from '../domain/Incident';
import { IncidentType, SeverityLevel } from '../domain/enums';

// the snapshot the rule engine passes to each rule for evaluation
export interface RuleEvaluationContext {
  device: Device;
  // unix timestamp (seconds) for when the evaluation is happening
  nowSeconds: number;
}

// result returned when a rule decides an incident should be created
export interface RuleMatch {
  type: IncidentType;
  // severity lives on the match so the service does not need to look up the rule again
  severity: SeverityLevel;
  // human-readable description of what went wrong
  summary: string;
  // the relevant telemetry values that triggered the rule
  context: Record<string, unknown>;
}

/*
every rule must implement this interface.
the engine calls evaluate() on each rule and collects the matches.
*/
export interface IncidentRule {
  readonly type: IncidentType;
  // the seriousness of incidents this rule creates
  readonly severity: SeverityLevel;
  // returns a match if the rule fires, or null if the device looks fine for this rule
  evaluate(ctx: RuleEvaluationContext): RuleMatch | null;
  // builds the ordered troubleshooting steps for this specific rule
  buildTroubleshootingSteps(match: RuleMatch, device: Device): Incident['troubleshootingSteps'];
}
