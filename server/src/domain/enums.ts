/*
this file defines the fixed sets of values used across the system.
using enums prevents typos and makes the states explicit and searchable.
*/

// describes what state a device is currently in
export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  DEGRADED = 'DEGRADED',
  UNKNOWN = 'UNKNOWN',
}

// the types of problems the system can detect on a device
export enum IncidentType {
  OFFLINE = 'OFFLINE',
  NO_RENDER = 'NO_RENDER',
  DETECTION_STALE = 'DETECTION_STALE',
  WEAK_NETWORK = 'WEAK_NETWORK',
}

// how serious a detected problem is
export enum SeverityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// whether an incident is still happening or has been resolved
export enum IncidentStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
}

// the delivery channel used for a notification
export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

// lifecycle state of a notification outbox entry
export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}
