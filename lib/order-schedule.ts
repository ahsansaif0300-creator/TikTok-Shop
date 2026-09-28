const WALL_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Pakistan UTC+5, matching store operators when the browser offset is missing. */
const FALLBACK_TIMEZONE_OFFSET_MINUTES = -300;

export const SCHEDULED_STAFF_NOTE = "Scheduled by super admin";
export const PLACED_STAFF_NOTE = "Placed by super admin";

/**
 * Parse a datetime-local wall clock using the browser's getTimezoneOffset()
 * so 5:57 PM in Pakistan is stored as 5:57 PM Pakistan, not 5:57 PM UTC.
 */
export function parseOrderWallTime(raw: string, offsetMinutesRaw = "") {
  const trimmed = raw.trim();
  const match = WALL_TIME.exec(trimmed);
  if (!match) {
    return new Date(trimmed);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  const parsedOffset = Number(offsetMinutesRaw);
  const offsetMinutes = Number.isFinite(parsedOffset) ? parsedOffset : FALLBACK_TIMEZONE_OFFSET_MINUTES;
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) + offsetMinutes * 60_000);
}

export function isOrderDue(createdAt: Date, now = new Date()) {
  return createdAt.getTime() <= now.getTime();
}

export function merchantVisibleOrdersWhere(now = new Date()) {
  return { createdAt: { lte: now } };
}
