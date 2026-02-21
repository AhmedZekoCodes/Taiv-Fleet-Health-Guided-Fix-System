/*
this runs every registered rule against a device and collects all matches.
it does not create incidents itself — that responsibility belongs to the incident service.
*/

import { IncidentRule, RuleEvaluationContext, RuleMatch } from './IncidentRule';
import { Device } from '../domain/Device';

export interface RuleEngineResult {
  device: Device;
  matches: RuleMatch[];
}

export class RuleEngine {
  private readonly rules: IncidentRule[];

  constructor(rules: IncidentRule[]) {
    this.rules = rules;
  }

  // runs all registered rules against the given device at the given time
  evaluate(device: Device, nowSeconds: number): RuleEngineResult {
    const ctx: RuleEvaluationContext = { device, nowSeconds };

    const matches = this.rules
      .map((rule) => rule.evaluate(ctx))
      .filter((match): match is RuleMatch => match !== null);

    return { device, matches };
  }

  // allows callers to inspect which rules are registered (useful for tests)
  getRuleTypes(): IncidentRule['type'][] {
    return this.rules.map((r) => r.type);
  }
}
