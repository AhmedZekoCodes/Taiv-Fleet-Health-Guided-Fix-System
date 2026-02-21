/*
this factory produces the right set of guided steps for any rule match.
it delegates to the rule that originally fired, keeping step logic with the rule.
*/

import { IncidentRule } from '../rules/IncidentRule';
import { RuleMatch } from '../rules/IncidentRule';
import { Device } from '../domain/Device';
import { TroubleshootingStep } from '../domain/Incident';
import { IncidentType } from '../domain/enums';

export class TroubleshootingStepFactory {
  // map of incident type → rule, built once at construction time
  private readonly ruleMap: Map<IncidentType, IncidentRule>;

  constructor(rules: IncidentRule[]) {
    this.ruleMap = new Map(rules.map((r) => [r.type, r]));
  }

  // returns the ordered troubleshooting steps for the given match and device context
  buildSteps(match: RuleMatch, device: Device): TroubleshootingStep[] {
    const rule = this.ruleMap.get(match.type);

    // this should never happen if the factory and engine are built from the same rule list
    if (!rule) {
      throw new Error(`no rule registered in step factory for incident type: ${match.type}`);
    }

    return rule.buildTroubleshootingSteps(match, device);
  }
}
