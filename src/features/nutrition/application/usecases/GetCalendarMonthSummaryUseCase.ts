import { FoodEntryRepository } from '../ports/FoodEntryRepository';
import { GoalsRepository } from '../ports/GoalsRepository';
import { buildDailySummary } from '../../domain/summary/DailySummaryCalculator';
import { buildCalendarMonthSummary } from '../../domain/calendar/CalendarMonthBuilder';
import { CalendarMonthSummary } from '../../domain/calendar/CalendarTypes';
import { getDateISOInTimezone } from '../../domain/reminders/ReminderDecisionEngine';
import { FoodEntry } from '../../domain/models/NutritionTypes';

function getDateRangeForMonth(monthISO: string): {
  startDateISO: string;
  endDateISO: string;
  days: number;
} {
  const [year, month] = monthISO.split('-').map((value) => Number.parseInt(value, 10));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDateISO: `${monthISO}-01`,
    endDateISO: `${monthISO}-${String(days).padStart(2, '0')}`,
    days,
  };
}

export class GetCalendarMonthSummaryUseCase {
  constructor(
    private readonly foodEntryRepository: FoodEntryRepository,
    private readonly goalsRepository: GoalsRepository,
    private readonly defaultTimezone: string = 'Europe/Berlin',
  ) {}

  async execute(monthISO: string, timezone?: string): Promise<CalendarMonthSummary> {
    const zone = timezone ?? this.defaultTimezone;
    const { startDateISO, endDateISO, days } = getDateRangeForMonth(monthISO);
    const [entries, goals] = await Promise.all([
      this.foodEntryRepository.listByDateRange(startDateISO, endDateISO),
      this.goalsRepository.getGoals(),
    ]);

    const byDate = new Map<string, FoodEntry[]>();
    for (const entry of entries) {
      const dateISO = getDateISOInTimezone(entry.createdAt.toISOString(), zone);
      const current = byDate.get(dateISO) ?? [];
      current.push(entry);
      byDate.set(dateISO, current);
    }

    const dailySummariesByDate: Record<string, ReturnType<typeof buildDailySummary>> = {};
    for (let day = 1; day <= days; day += 1) {
      const dateISO = `${monthISO}-${String(day).padStart(2, '0')}`;
      dailySummariesByDate[dateISO] = buildDailySummary(dateISO, byDate.get(dateISO) ?? [], goals);
    }

    return buildCalendarMonthSummary(monthISO, dailySummariesByDate);
  }
}
