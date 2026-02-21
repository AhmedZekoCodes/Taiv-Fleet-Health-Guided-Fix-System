/*
this file holds all fixed numbers and limits used across the system.
keeping them here means we change one place instead of hunting through every file.
*/

// how many seconds can pass before a device is considered offline
export const OFFLINE_THRESHOLD_SECONDS = 90;

// how many seconds can pass without a render before we flag a no-render incident
export const NO_RENDER_THRESHOLD_SECONDS = 300;

// how many seconds can pass without a detection event before we flag it as stale
export const DETECTION_STALE_THRESHOLD_SECONDS = 600;

// rssi below this value (in dBm) means the network signal is weak
export const WEAK_NETWORK_RSSI_THRESHOLD_DBM = -75;

// the signal strength percentage below which we flag a weak network
export const WEAK_NETWORK_SIGNAL_PERCENT_THRESHOLD = 30;

// how often the frontend should poll the api for updates (milliseconds)
export const POLLING_INTERVAL_MS = 5000;

// max number of troubleshooting steps we generate per incident
export const MAX_TROUBLESHOOTING_STEPS = 8;

// how many past incidents to keep in history per device
export const INCIDENT_HISTORY_LIMIT = 50;
