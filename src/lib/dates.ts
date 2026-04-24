import { endOfWeek, startOfDay, startOfWeek } from 'date-fns';

const EASTERN_TZ = 'America/New_York';
const PACIFIC_TZ = 'America/Los_Angeles';

function hasExplicitOffset(dateStr: string) {
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(dateStr);
}

function getParts(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', { timeZone, ...options }).formatToParts(date);
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find(part => part.type === type)?.value ?? '';
}

function formatDateKey(date: Date, timeZone: string) {
  const parts = getParts(date, timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return `${getPart(parts, 'year')}-${getPart(parts, 'month')}-${getPart(parts, 'day')}`;
}

function formatTimeKey(date: Date, timeZone: string) {
  const parts = getParts(date, timeZone, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${getPart(parts, 'hour')}:${getPart(parts, 'minute')}`;
}

function formatMonthDayTime(date: Date, timeZone: string) {
  const parts = getParts(date, timeZone, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${getPart(parts, 'month')} ${getPart(parts, 'day')} ${getPart(parts, 'hour')}:${getPart(parts, 'minute')} ${getPart(parts, 'dayPeriod')}`;
}

function formatLocalDateTimeKey(date: Date, timeZone: string) {
  const parts = getParts(date, timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${getPart(parts, 'year')}-${getPart(parts, 'month')}-${getPart(parts, 'day')}T${getPart(parts, 'hour')}:${getPart(parts, 'minute')}`;
}

function normalizeOffset(offsetName: string) {
  if (offsetName === 'GMT') return '+00:00';
  const match = offsetName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return '+00:00';
  const [, sign, hours, minutes = '00'] = match;
  return `${sign}${hours.padStart(2, '0')}:${minutes}`;
}

function getOffsetForTimeZone(date: Date, timeZone: string) {
  const parts = getParts(date, timeZone, {
    timeZoneName: 'longOffset',
    hour: '2-digit',
    minute: '2-digit',
  });
  return normalizeOffset(getPart(parts, 'timeZoneName'));
}

function getZoneAbbreviation(date: Date, timeZone: string) {
  const parts = getParts(date, timeZone, { timeZoneName: 'short' });
  return getPart(parts, 'timeZoneName');
}

function resolveWallClockDateTime(dateStr: string, timeStr: string, timeZone: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const requestedKey = `${dateStr}T${timeStr}`;
  const baseUtc = Date.UTC(year, month - 1, day, hour, minute);
  const candidateOffsets = new Set<string>();

  for (const probeHours of [-24, -12, 0, 12, 24]) {
    candidateOffsets.add(getOffsetForTimeZone(new Date(baseUtc + probeHours * 60 * 60 * 1000), timeZone));
  }

  let exactMatch: { instant: Date; localKey: string; offset: string } | null = null;
  let normalizedMatch: { instant: Date; localKey: string; offset: string } | null = null;

  for (const offset of candidateOffsets) {
    const instant = new Date(`${dateStr}T${timeStr}:00${offset}`);
    const localKey = formatLocalDateTimeKey(instant, timeZone);
    const candidate = { instant, localKey, offset: getOffsetForTimeZone(instant, timeZone) };

    if (localKey === requestedKey) {
      if (!exactMatch || instant.getTime() < exactMatch.instant.getTime()) {
        exactMatch = candidate;
      }
      continue;
    }

    if (localKey > requestedKey) {
      if (!normalizedMatch || localKey < normalizedMatch.localKey || (localKey === normalizedMatch.localKey && instant.getTime() < normalizedMatch.instant.getTime())) {
        normalizedMatch = candidate;
      }
    }
  }

  return exactMatch ?? normalizedMatch ?? {
    instant: new Date(`${dateStr}T${timeStr}:00`),
    localKey: requestedKey,
    offset: getOffsetForTimeZone(new Date(baseUtc), timeZone),
  };
}

function splitLocalDateTime(dateStr: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { date: dateStr, time: '12:00' };
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateStr)) {
    const [date, time] = dateStr.split('T');
    return { date, time };
  }
  return null;
}

function zonedMidnight(date: Date, timeZone: string) {
  return new Date(`${formatDateKey(date, timeZone)}T00:00:00Z`);
}

/** Parse a stored due date as an absolute instant using New York wall time as the source of truth. */
export function parseDueDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  if (hasExplicitOffset(dateStr)) return new Date(dateStr);

  const split = splitLocalDateTime(dateStr);
  if (!split) return new Date(dateStr);
  return new Date(buildDueDateValue(split.date, split.time));
}

export function formatDueDate(dateStr: string | null): string {
  const due = parseDueDate(dateStr);
  if (!due) return '';
  return `${formatMonthDayTime(due, EASTERN_TZ)} (${getZoneAbbreviation(due, EASTERN_TZ)})`;
}

export function formatDueDatePST(dateStr: string | null): string {
  const due = parseDueDate(dateStr);
  if (!due) return '';
  return `${formatMonthDayTime(due, PACIFIC_TZ)} (${getZoneAbbreviation(due, PACIFIC_TZ)})`;
}

export function isDueToday(dateStr: string | null): boolean {
  const due = parseDueDate(dateStr);
  if (!due) return false;
  return formatDateKey(due, EASTERN_TZ) === formatDateKey(new Date(), EASTERN_TZ);
}

export function isDueOverdue(dateStr: string | null): boolean {
  const due = parseDueDate(dateStr);
  if (!due) return false;
  const dueDay = startOfDay(zonedMidnight(due, EASTERN_TZ));
  const today = startOfDay(zonedMidnight(new Date(), EASTERN_TZ));
  return dueDay < today;
}

export function isDueThisWeek(dateStr: string | null): boolean {
  const due = parseDueDate(dateStr);
  if (!due) return false;
  const today = startOfDay(zonedMidnight(new Date(), EASTERN_TZ));
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
  const dueDay = startOfDay(zonedMidnight(due, EASTERN_TZ));
  return dueDay >= weekStart && dueDay <= weekEnd;
}

export function getDueDateKey(dateStr: string | null): string | null {
  const due = parseDueDate(dateStr);
  if (!due) return null;
  return formatDateKey(due, EASTERN_TZ);
}

export function getDueDateInputValue(dateStr: string | null): string {
  const due = parseDueDate(dateStr);
  if (!due) return '';
  return formatDateKey(due, EASTERN_TZ);
}

export function getDueTimeInputValue(dateStr: string | null): string {
  const due = parseDueDate(dateStr);
  if (!due) return '12:00';
  return formatTimeKey(due, EASTERN_TZ);
}

export function buildDueDateValue(dateStr: string, timeStr: string): string {
  const normalizedTime = timeStr || '12:00';
  const resolved = resolveWallClockDateTime(dateStr, normalizedTime, EASTERN_TZ);
  return `${resolved.localKey}:00${resolved.offset}`;
}
