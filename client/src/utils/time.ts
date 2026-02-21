/*
utility functions for displaying timestamps in a human-readable way.
all functions accept either a unix timestamp in seconds or an iso date string.
*/

// converts a unix seconds timestamp or iso string into a Date object
function toDate(value: number | string): Date {
  // numbers are treated as unix seconds; strings are parsed as iso dates
  return typeof value === 'number' ? new Date(value * 1000) : new Date(value);
}

// returns a short relative label like "12s ago", "4m ago", or "2h ago"
export function formatRelativeTime(value: number | string): string {
  const ms = Date.now() - toDate(value).getTime();
  const seconds = Math.floor(ms / 1000);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

// returns a short date+time string for incident timestamps
export function formatDateTime(value: number | string): string {
  return toDate(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
