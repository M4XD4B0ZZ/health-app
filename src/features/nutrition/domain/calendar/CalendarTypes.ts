export type DayStatus = 'none' | 'logged' | 'goal_ontrack' | 'goal_over' | 'goal_under';

export interface CalendarDaySummary {
  dateISO: string;
  status: DayStatus;
  totalCaloriesKcal: number;
  hasEntries: boolean;
  notesDe?: string[];
}

export interface CalendarMonthSummary {
  monthISO: string;
  days: CalendarDaySummary[];
  stats: {
    loggedDays: number;
    ontrackDays: number;
    underDays: number;
    overDays: number;
  };
}
