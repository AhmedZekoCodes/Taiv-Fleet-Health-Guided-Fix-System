/*
this wires all the rules together and exports ready-to-use factories.
adding a new rule means adding it to the list here — no other file needs to change.
*/

import { RuleEngine } from './RuleEngine';
import { TroubleshootingStepFactory } from '../services/TroubleshootingStepFactory';
import { OfflineRule } from './OfflineRule';
import { NoRenderRule } from './NoRenderRule';
import { DetectionStaleRule } from './DetectionStaleRule';
import { WeakNetworkRule } from './WeakNetworkRule';

export interface IncidentPipeline {
  ruleEngine: RuleEngine;
  stepFactory: TroubleshootingStepFactory;
}

// both the engine and the factory share the same rule instances
export function createDefaultIncidentPipeline(): IncidentPipeline {
  const rules = [
    new OfflineRule(),
    new NoRenderRule(),
    new DetectionStaleRule(),
    new WeakNetworkRule(),
  ];
  return {
    ruleEngine: new RuleEngine(rules),
    stepFactory: new TroubleshootingStepFactory(rules),
  };
}

export function createDefaultRuleEngine(): RuleEngine {
  return createDefaultIncidentPipeline().ruleEngine;
}

export { RuleEngine } from './RuleEngine';
export { OfflineRule } from './OfflineRule';
export { NoRenderRule } from './NoRenderRule';
export { DetectionStaleRule } from './DetectionStaleRule';
export { WeakNetworkRule } from './WeakNetworkRule';
export type { IncidentRule, RuleEvaluationContext, RuleMatch } from './IncidentRule';
