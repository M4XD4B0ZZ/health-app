import { DailySummary } from '../summary/DailySummaryTypes';
import { ReminderDecision, ReminderSettings } from './ReminderTypes';

const DEFAULT_TIME = '20:00';

function parseTimeLocal(value: string): { hour: number; minute: number } | null {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return null;
  }

  return {
    hour: Number.parseInt(match[1], 10),
    minute: Number.parseInt(match[2], 10),
  };
}

function getZonedParts(
  iso: string,
  timezone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const date = new Date(iso);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number.parseInt(byType.year, 10),
    month: Number.parseInt(byType.month, 10),
    day: Number.parseInt(byType.day, 10),
    hour: Number.parseInt(byType.hour, 10),
    minute: Number.parseInt(byType.minute, 10),
  };
}

function getLocalStamp(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

function toPlannedISO(nowISO: string, timezone: string, timeLocal: string): string | undefined {
  const parsedTime = parseTimeLocal(timeLocal);
  if (!parsedTime) {
    return undefined;
  }

  const today = getZonedParts(nowISO, timezone);
  const targetStamp = Date.UTC(
    today.year,
    today.month - 1,
    today.day,
    parsedTime.hour,
    parsedTime.minute,
  );
  let candidateMs = Date.UTC(
    today.year,
    today.month - 1,
    today.day,
    parsedTime.hour,
    parsedTime.minute,
  );

  for (let i = 0; i < 8; i += 1) {
    const candidateParts = getZonedParts(new Date(candidateMs).toISOString(), timezone);
    const currentStamp = getLocalStamp(candidateParts);
    const diffMinutes = Math.round((targetStamp - currentStamp) / 60000);
    if (diffMinutes === 0) {
      break;
    }
    candidateMs += diffMinutes * 60000;
  }

  return new Date(candidateMs).toISOString();
}

export function getDateISOInTimezone(nowISO: string, timezone: string): string {
  const zoned = getZonedParts(nowISO, timezone);
  const month = String(zoned.month).padStart(2, '0');
  const day = String(zoned.day).padStart(2, '0');
  return `${zoned.year}-${month}-${day}`;
}

export function decideDailyReminder(
  nowISO: string,
  timezone: string,
  settings: ReminderSettings,
  dailySummary: DailySummary,
): ReminderDecision {
  const effectiveTime = parseTimeLocal(settings.timeLocal) ? settings.timeLocal : DEFAULT_TIME;
  const parsedTime = parseTimeLocal(effectiveTime)!;
  const nowLocal = getZonedParts(nowISO, timezone);
  const nowMinutes = nowLocal.hour * 60 + nowLocal.minute;
  const targetMinutes = parsedTime.hour * 60 + parsedTime.minute;
  const hasEntries = dailySummary.entries.length > 0;

  if (!settings.isEnabled) {
    return {
      shouldNotify: false,
      reasonCodes: ['DISABLED'],
      messageDe: 'Erinnerung ist deaktiviert.',
    };
  }

  if (hasEntries) {
    return {
      shouldNotify: false,
      reasonCodes: ['ALREADY_LOGGED'],
      messageDe: 'Für heute sind bereits Einträge vorhanden.',
    };
  }

  if (nowMinutes < targetMinutes) {
    return {
      shouldNotify: false,
      reasonCodes: ['TOO_EARLY'],
      plannedAtISO: toPlannedISO(nowISO, timezone, effectiveTime),
      messageDe: `Erinnerung ist für ${effectiveTime} geplant.`,
    };
  }

  return {
    shouldNotify: true,
    reasonCodes: ['NO_LOGS_TODAY'],
    messageDe: 'Du hast heute noch nichts geloggt.',
  };
}
