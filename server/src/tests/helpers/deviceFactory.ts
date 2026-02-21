/*
this factory builds fake device objects for tests.
using a factory keeps test setup short and consistent across all test files.
*/

import { Device, DeviceTelemetry } from '../../domain/Device';
import { DeviceStatus } from '../../domain/enums';

// the base snapshot every test starts from — device is healthy and online
const defaultTelemetry: DeviceTelemetry = {
  lastHeartbeatAt: 1000000,
  lastRenderAt: 1000000,
  lastDetectionAt: 1000000,
  signalStrengthPercent: 80,
  rssiDbm: -55,
  firmwareVersion: '1.2.3',
};

// partial overrides let each test customize only the fields it cares about
export function makeDevice(overrides: Partial<Device> = {}, telemetryOverrides: Partial<DeviceTelemetry> = {}): Device {
  return {
    id: 'device-test-001',
    venueId: 'venue-test-001',
    label: 'Bar TV 1',
    status: DeviceStatus.ONLINE,
    telemetry: {
      ...defaultTelemetry,
      ...telemetryOverrides,
    },
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}
