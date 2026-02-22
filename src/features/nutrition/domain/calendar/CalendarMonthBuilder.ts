import { DailySummary } from '../summary/DailySummaryTypes';
import { CalendarDaySummary, CalendarMonthSummary, DayStatus } from './CalendarTypes';

function getMonthDays(monthISO: string): number {
  const [year, month] = monthISO.split('-').map((v) => Number.parseInt(v, 10));
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toDateISO(monthISO: string, day: number): string {
  return `${monthISO}-${String(day).padStart(2, '0')}`;
}

function toDayStatus(summary?: DailySummary): DayStatus {
  if (!summary || !summary.entries.length) {
    return 'none';
  }

  if (summary.notesDe?.includes('Kein Ziel gesetzt.')) {
    return 'logged';
  }

  const status = summary.progress.calories.status;
  if (status === 'ontrack') {
    return 'goal_ontrack';
  }
  if (status === 'over') {
    return 'goal_over';
  }
  return 'goal_under';
}

export function buildCalendarMonthSummary(
  monthISO: string,
  dailySummariesByDate: Record<string, DailySummary>,
): CalendarMonthSummary {
  const daysInMonth = getMonthDays(monthISO);
  const days: CalendarDaySummary[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateISO = toDateISO(monthISO, day);
    const summary = dailySummariesByDate[dateISO];
    const status = toDayStatus(summary);

    days.push({
      dateISO,
      status,
      totalCaloriesKcal: summary?.totals.caloriesKcal ?? 0,
      hasEntries: Boolean(summary?.entries.length),
      notesDe: summary?.notesDe,
    });
  }

  return {
    monthISO,
    days,
    stats: {
      loggedDays: days.filter((day) => day.status !== 'none').length,
      ontrackDays: days.filter((day) => day.status === 'goal_ontrack').length,
      underDays: days.filter((day) => day.status === 'goal_under').length,
      overDays: days.filter((day) => day.status === 'goal_over').length,
    },
  };
}
