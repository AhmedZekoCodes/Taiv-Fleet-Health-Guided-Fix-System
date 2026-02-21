/*
this wires all the rules together and exports a ready-to-use rule engine.
adding a new rule means adding it to this list — no other file needs to change.
*/

import { RuleEngine } from './RuleEngine';
import { OfflineRule } from './OfflineRule';
import { NoRenderRule } from './NoRenderRule';
import { DetectionStaleRule } from './DetectionStaleRule';
import { WeakNetworkRule } from './WeakNetworkRule';

export function createDefaultRuleEngine(): RuleEngine {
  return new RuleEngine([
    new OfflineRule(),
    new NoRenderRule(),
    new DetectionStaleRule(),
    new WeakNetworkRule(),
  ]);
}

export { RuleEngine } from './RuleEngine';
export { OfflineRule } from './OfflineRule';
export { NoRenderRule } from './NoRenderRule';
export { DetectionStaleRule } from './DetectionStaleRule';
export { WeakNetworkRule } from './WeakNetworkRule';
export type { IncidentRule, RuleEvaluationContext, RuleMatch } from './IncidentRule';
