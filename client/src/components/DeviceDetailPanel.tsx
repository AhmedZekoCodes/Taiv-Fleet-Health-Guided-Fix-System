import React, { useState } from 'react';
import { DeviceDetail, Incident } from '../api/types';
import { GlassCard } from './ui/GlassCard';
import { StatusBadge } from './ui/StatusBadge';
import { TroubleshootingSteps } from './TroubleshootingSteps';
import { formatRelativeTime, formatDateTime } from '../utils/time';

// severity controls the opacity of the left accent on incident cards — no new colors
const SEVERITY_ACCENT_OPACITY: Record<string, number> = {
  CRITICAL: 0.85,
  HIGH: 0.6,
  MEDIUM: 0.32,
  LOW: 0.15,
};

interface Props {
  deviceId: string | null;
  detail: DeviceDetail | null;
  loading: boolean;
  error: string | null;
}

// the right-side detail inspector panel
export function DeviceDetailPanel({ deviceId, detail, loading, error }: Props): React.ReactElement {
  // which incident's steps are currently expanded — null means all collapsed
  const [expandedIncidentId, setExpandedIncidentId] = useState<string | null>(null);

  // empty state — no device selected
  if (!deviceId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-white/22 text-center px-8">
          Select a device from the list to inspect it.
        </p>
      </div>
    );
  }

  // first-load spinner
  if (loading && !detail) {
    return (
      <div className="flex h-full items-center justify-center">
        <div
          className="h-5 w-5 rounded-full border-2 border-brand-primary/50 border-t-transparent animate-spin"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  // error state
  if (error && !detail) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-white/35">{error}</p>
      </div>
    );
  }

  if (!detail) {
    return <></>;
  }

  const { device, openIncidents } = detail;
  const t = device.telemetry;

  return (
    /*
    the key makes react create a fresh dom node each time the selected device changes.
    this restarts the entrance animation without needing any extra state.
    */
    <div key={deviceId} className="h-full overflow-y-auto px-5 py-5 space-y-4 animate-panel-enter">
      {/* device header — label + id + venue + current status */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-white/95 leading-tight">
            {device.label}
          </h2>
          <p className="mt-0.5 text-meta">
            {device.id} · {device.venueId}
          </p>
        </div>
        <div className="flex-shrink-0 mt-0.5">
          <StatusBadge status={device.status} />
        </div>
      </div>

      {/* telemetry card */}
      <GlassCard variant="elevated" className="p-4 animate-panel-enter">
        <h3 className="label-section mb-3">Telemetry</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <TelemetryField label="Last heartbeat" value={formatRelativeTime(t.lastHeartbeatAt)} />
          <TelemetryField
            label="Last render"
            value={t.lastRenderAt ? formatRelativeTime(t.lastRenderAt) : 'never'}
            dim={!t.lastRenderAt}
          />
          <TelemetryField
            label="Last detection"
            value={t.lastDetectionAt ? formatRelativeTime(t.lastDetectionAt) : 'never'}
            dim={!t.lastDetectionAt}
          />
          <TelemetryField
            label="Signal"
            value={t.signalStrengthPercent !== null ? `${t.signalStrengthPercent}%` : '—'}
          />
          <TelemetryField
            label="RSSI"
            value={t.rssiDbm !== null ? `${t.rssiDbm} dBm` : '—'}
          />
          <TelemetryField
            label="Firmware"
            value={t.firmwareVersion ?? '—'}
          />
        </dl>
      </GlassCard>

      {/* incidents section */}
      <div className="animate-panel-enter-delay">
        <div className="flex items-center justify-between mb-3">
          <h3 className="label-section">Open Incidents</h3>
          {openIncidents.length > 0 && (
            <span
              className="glass rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
              style={{ color: 'rgba(112, 81, 245, 0.9)' }}
            >
              {openIncidents.length}
            </span>
          )}
        </div>

        {openIncidents.length === 0 ? (
          <GlassCard variant="inset" className="px-4 py-6 text-center">
            <p className="text-sm text-white/22">No open incidents.</p>
          </GlassCard>
        ) : (
          <div className="space-y-2.5">
            {openIncidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                expanded={expandedIncidentId === incident.id}
                onToggle={() =>
                  setExpandedIncidentId((prev) =>
                    prev === incident.id ? null : incident.id,
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// telemetry field
// ----------------------------------------------------------------

function TelemetryField({
  label,
  value,
  dim = false,
}: {
  label: string;
  value: string;
  dim?: boolean;
}): React.ReactElement {
  return (
    <div>
      <dt className="label-section mb-0.5">{label}</dt>
      <dd className={`text-sm tabular-nums leading-tight ${dim ? 'text-white/28' : 'text-white/80'}`}>
        {value}
      </dd>
    </div>
  );
}

// ----------------------------------------------------------------
// incident card
// ----------------------------------------------------------------

function IncidentCard({
  incident,
  expanded,
  onToggle,
}: {
  incident: Incident;
  expanded: boolean;
  onToggle: () => void;
}): React.ReactElement {
  // left border opacity encodes severity — no new colors introduced
  const accentOpacity = SEVERITY_ACCENT_OPACITY[incident.severity] ?? 0.2;

  // severity label opacity provides visual weight hierarchy
  const severityTextOpacity =
    incident.severity === 'CRITICAL' ? 'text-white/90'
    : incident.severity === 'HIGH'     ? 'text-white/70'
    : incident.severity === 'MEDIUM'   ? 'text-white/50'
    : 'text-white/35';

  return (
    <GlassCard
      variant="default"
      className="overflow-hidden"
      style={{
        borderLeft: `2px solid rgba(112, 81, 245, ${accentOpacity})`,
      }}
    >
      {/* incident header row — click to expand/collapse steps */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-3.5 text-left
          transition-colors duration-base ease-brand hover:bg-white/[0.05]
          focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-brand-primary/60"
      >
        {/* severity dot — opacity encodes how serious the incident is */}
        <span
          className="mt-1.5 flex-shrink-0 h-1.5 w-1.5 rounded-full bg-brand-primary"
          style={{ opacity: accentOpacity }}
          aria-hidden="true"
        />

        <div className="flex-1 min-w-0">
          {/* incident type + severity label */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-white/82 tracking-wide">
              {incident.type.replace(/_/g, ' ')}
            </span>
            <span className={`text-[10px] font-medium ${severityTextOpacity}`}>
              {incident.severity}
            </span>
          </div>

          {/* human-readable incident summary */}
          <p className="mt-0.5 text-xs text-white/45 leading-relaxed line-clamp-2">
            {incident.summary}
          </p>

          {/* when the incident was detected */}
          <p className="mt-1 text-meta">detected {formatDateTime(incident.detectedAt)}</p>
        </div>

        {/* expand / collapse chevron */}
        <span
          className={`flex-shrink-0 text-white/28 text-xs mt-0.5
            transition-transform duration-base ease-brand
            ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {/* collapsible troubleshooting steps */}
      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-white/[0.06]">
          <div className="pt-3">
            <TroubleshootingSteps
              steps={incident.troubleshootingSteps}
              incidentSummary={incident.summary}
            />
          </div>
        </div>
      )}
    </GlassCard>
  );
}
