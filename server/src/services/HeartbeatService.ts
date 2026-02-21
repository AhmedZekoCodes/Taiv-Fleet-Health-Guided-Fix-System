/*
this service is the core of step 2. it handles the full lifecycle of one heartbeat:
upsert the device, run rules, open new incidents, resolve cleared ones.
*/

import { randomUUID } from 'crypto';
import { IDeviceRepository } from '../repositories/IDeviceRepository';
import { IIncidentRepository } from '../repositories/IIncidentRepository';
import { RuleEngine } from '../rules/RuleEngine';
import { RuleMatch } from '../rules/IncidentRule';
import { TroubleshootingStepFactory } from './TroubleshootingStepFactory';
import { HeartbeatDto } from '../controllers/dtos/HeartbeatDto';
import { Device } from '../domain/Device';
import { Incident } from '../domain/Incident';
import { DeviceStatus, IncidentStatus, IncidentType } from '../domain/enums';

export interface HeartbeatResult {
  device: Device;
  // incidents that were created by this heartbeat
  newIncidents: Incident[];
  // incidents that were open before but are now resolved
  resolvedIncidents: Incident[];
}

export class HeartbeatService {
  private readonly deviceRepo: IDeviceRepository;
  private readonly incidentRepo: IIncidentRepository;
  private readonly ruleEngine: RuleEngine;
  private readonly stepFactory: TroubleshootingStepFactory;
  // the clock lets tests inject a fixed time without touching real time
  private readonly clock: () => number;

  constructor(
    deviceRepo: IDeviceRepository,
    incidentRepo: IIncidentRepository,
    ruleEngine: RuleEngine,
    stepFactory: TroubleshootingStepFactory,
    clock: () => number = () => Math.floor(Date.now() / 1000),
  ) {
    this.deviceRepo = deviceRepo;
    this.incidentRepo = incidentRepo;
    this.ruleEngine = ruleEngine;
    this.stepFactory = stepFactory;
    this.clock = clock;
  }

  handleHeartbeat(dto: HeartbeatDto): HeartbeatResult {
    const nowSeconds = this.clock();
    const nowDate = new Date(nowSeconds * 1000);

    // build the device domain object from the incoming telemetry
    const existing = this.deviceRepo.findById(dto.deviceId);
    const device = this.buildDevice(dto, nowSeconds, nowDate, existing);

    // run all rules before persisting so status can reflect current match state
    const { matches } = this.ruleEngine.evaluate(device, nowSeconds);

    // derive status from what the rules found
    device.status = this.computeStatus(matches);

    // persist the device with its fresh telemetry and computed status
    this.deviceRepo.upsert(device);

    // handle open incidents — resolve cleared ones, keep active ones open
    const openIncidents = this.incidentRepo.findOpenByDeviceId(dto.deviceId);
    const matchedTypes = new Set(matches.map((m) => m.type));

    const resolvedIncidents: Incident[] = [];
    const stillOpenTypes = new Set<IncidentType>();

    for (const incident of openIncidents) {
      if (matchedTypes.has(incident.type)) {
        // rule still fires — keep the incident open and update its timestamp
        this.incidentRepo.updateTimestamp(incident.id, nowDate);
        stillOpenTypes.add(incident.type);
      } else {
        // rule no longer fires — the problem cleared, so resolve the incident
        this.incidentRepo.resolve(incident.id, nowDate);
        resolvedIncidents.push({
          ...incident,
          status: IncidentStatus.RESOLVED,
          resolvedAt: nowDate,
          updatedAt: nowDate,
        });
      }
    }

    // create new incidents for rule matches that have no open incident yet
    const newIncidents: Incident[] = [];

    for (const match of matches) {
      if (stillOpenTypes.has(match.type)) {
        // there is already an open incident tracking this problem
        continue;
      }

      const steps = this.stepFactory.buildSteps(match, device);
      const incident: Incident = {
        id: randomUUID(),
        deviceId: dto.deviceId,
        venueId: dto.venueId,
        type: match.type,
        severity: match.severity,
        status: IncidentStatus.OPEN,
        summary: match.summary,
        context: match.context,
        troubleshootingSteps: steps,
        detectedAt: nowDate,
        resolvedAt: null,
        updatedAt: nowDate,
      };

      this.incidentRepo.create(incident);
      newIncidents.push(incident);
    }

    return { device, newIncidents, resolvedIncidents };
  }

  // builds the Device object from the dto, preserving created_at from the existing record
  private buildDevice(
    dto: HeartbeatDto,
    nowSeconds: number,
    nowDate: Date,
    existing: Device | null,
  ): Device {
    return {
      id: dto.deviceId,
      venueId: dto.venueId,
      label: dto.label,
      // status starts unknown and gets set after rule evaluation
      status: DeviceStatus.UNKNOWN,
      telemetry: {
        lastHeartbeatAt: nowSeconds,
        lastRenderAt: dto.lastRenderAt ?? null,
        lastDetectionAt: dto.lastDetectionAt ?? null,
        signalStrengthPercent: dto.signalStrengthPercent ?? null,
        rssiDbm: dto.rssiDbm ?? null,
        // keep the firmware version from the previous record if not provided
        firmwareVersion:
          dto.firmwareVersion ?? existing?.telemetry.firmwareVersion ?? null,
      },
      createdAt: existing?.createdAt ?? nowDate,
      updatedAt: nowDate,
    };
  }

  // maps rule matches to a device status — offline takes priority over degraded
  private computeStatus(matches: RuleMatch[]): DeviceStatus {
    if (matches.some((m) => m.type === IncidentType.OFFLINE)) {
      return DeviceStatus.OFFLINE;
    }
    if (matches.length > 0) {
      return DeviceStatus.DEGRADED;
    }
    return DeviceStatus.ONLINE;
  }
}
