import { buildCalendarMonthSummary } from '../domain/calendar/CalendarMonthBuilder';
import { DailySummary } from '../domain/summary/DailySummaryTypes';

function summary(input: Partial<DailySummary> & { dateISO: string }): DailySummary {
  return {
    dateISO: input.dateISO,
    date: input.date ?? input.dateISO,
    totalCalories: input.totalCalories ?? 0,
    totalProtein: input.totalProtein ?? 0,
    totalCarbs: input.totalCarbs ?? 0,
    totalFat: input.totalFat ?? 0,
    entries: input.entries ?? [],
    totals: input.totals ?? { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    remaining: input.remaining ?? { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    progress:
      input.progress ??
      ({
        calories: { consumed: 0, target: 0, remaining: 0, ratio: 0, status: 'under' },
        protein: { consumed: 0, target: 0, remaining: 0, ratio: 0, status: 'under' },
        carbs: { consumed: 0, target: 0, remaining: 0, ratio: 0, status: 'under' },
        fat: { consumed: 0, target: 0, remaining: 0, ratio: 0, status: 'under' },
      } as DailySummary['progress']),
    notesDe: input.notesDe,
  };
}

describe('CalendarMonthBuilder', () => {
  it('builds correct day count for leap-year February', () => {
    const month = buildCalendarMonthSummary('2024-02', {});
    expect(month.days).toHaveLength(29);
  });

  it('maps statuses and counts stats correctly', () => {
    const byDate: Record<string, DailySummary> = {
      '2026-02-01': summary({ dateISO: '2026-02-01', entries: [] }),
      '2026-02-02': summary({
        dateISO: '2026-02-02',
        entries: [{ id: '1' } as any],
        notesDe: ['Kein Ziel gesetzt.'],
      }),
      '2026-02-03': summary({
        dateISO: '2026-02-03',
        entries: [{ id: '2' } as any],
        progress: {
          calories: { consumed: 90, target: 100, remaining: 10, ratio: 0.9, status: 'under' },
          protein: { consumed: 0, target: 0, remaining: 0, ratio: 0, status: 'under' },
          carbs: { consumed: 0, target: 0, remaining: 0, ratio: 0, status: 'under' },
          fat: { consumed: 0, target: 0, remaining: 0, ratio: 0, status: 'under' },
        },
      }),
      '2026-02-04': summary({
        dateISO: '2026-02-04',
        entries: [{ id: '3' } as any],
        progress: {
          calories: { consumed: 100, target: 100, remaining: 0, ratio: 1, status: 'ontrack' },
          protein: { consumed: 0, target: 0, remaining: 0, ratio: 0, status: 'under' },
          carbs: { consumed: 0, target: 0, remaining: 0, ratio: 0, status: 'under' },
          fat: { consumed: 0, target: 0, remaining: 0, ratio: 0, status: 'under' },
        },
      }),
      '2026-02-05': summary({
        dateISO: '2026-02-05',
        entries: [{ id: '4' } as any],
        progress: {
          calories: { consumed: 120, target: 100, remaining: -20, ratio: 1.2, status: 'over' },
          protein: { consumed: 0, target: 0, remaining: 0, ratio: 0, status: 'under' },
          carbs: { consumed: 0, target: 0, remaining: 0, ratio: 0, status: 'under' },
          fat: { consumed: 0, target: 0, remaining: 0, ratio: 0, status: 'under' },
        },
      }),
    };

    const month = buildCalendarMonthSummary('2026-02', byDate);
    expect(month.days[0].status).toBe('none');
    expect(month.days[1].status).toBe('logged');
    expect(month.days[2].status).toBe('goal_under');
    expect(month.days[3].status).toBe('goal_ontrack');
    expect(month.days[4].status).toBe('goal_over');
    expect(month.stats.loggedDays).toBe(4);
    expect(month.stats.underDays).toBe(1);
    expect(month.stats.ontrackDays).toBe(1);
    expect(month.stats.overDays).toBe(1);
  });
});
