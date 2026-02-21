import React, { useState } from 'react';
import { TroubleshootingStep } from '../api/types';
import { GlassButton } from './ui/GlassButton';

interface Props {
  steps: TroubleshootingStep[];
  incidentSummary: string;
}

// formats the steps as a plain-text block for clipboard copy
function buildCopyText(summary: string, steps: TroubleshootingStep[]): string {
  const header = `INCIDENT: ${summary}\n${'─'.repeat(50)}\n`;
  const body = steps
    .map(
      (s) =>
        `${s.order}. ${s.title}\n   ${s.description}${s.requiresConfirmation ? '\n   ✓ Confirm when done' : ''}`,
    )
    .join('\n\n');
  return `${header}${body}`;
}

// shows the ordered list of troubleshooting steps with a copy-to-clipboard button
export function TroubleshootingSteps({ steps, incidentSummary }: Props): React.ReactElement {
  // 'idle' | 'copied' — drives the brief feedback after clicking copy
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  function handleCopy(): void {
    const text = buildCopyText(incidentSummary, steps);
    navigator.clipboard.writeText(text).then(() => {
      setCopyState('copied');
      // revert the label after 1.5s
      setTimeout(() => setCopyState('idle'), 1500);
    }, () => {
      // silently ignore clipboard permission failures
    });
  }

  return (
    <div className="space-y-2">
      {/* copy button lives at the top so ops can grab steps without scrolling */}
      <div className="flex justify-end">
        <GlassButton variant="subtle" onClick={handleCopy}>
          {copyState === 'copied' ? '✓ Copied' : '⎘ Copy steps'}
        </GlassButton>
      </div>

      {/* step list */}
      <ol className="space-y-2">
        {steps.map((step) => (
          <li key={step.order} className="glass-inset rounded-lg p-3">
            <div className="flex items-start gap-3">
              {/* step number circle */}
              <span
                className="flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white/70"
                style={{ background: 'rgba(112, 81, 245, 0.25)' }}
              >
                {step.order}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/85">{step.title}</p>
                <p className="mt-0.5 text-xs text-white/50 leading-relaxed">
                  {step.description}
                </p>
                {/* confirmation flag helps ops know when a manual check is needed */}
                {step.requiresConfirmation && (
                  <span className="mt-1.5 inline-block text-[10px] glass-inset rounded px-2 py-0.5 text-white/40 border-brand-primary/20">
                    requires confirmation
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
