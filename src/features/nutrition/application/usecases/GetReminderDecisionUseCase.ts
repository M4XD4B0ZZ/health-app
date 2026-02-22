import {
  decideDailyReminder,
  getDateISOInTimezone,
} from '../../domain/reminders/ReminderDecisionEngine';
import { ReminderDecision } from '../../domain/reminders/ReminderTypes';
import { ReminderSettingsRepository } from '../ports/ReminderSettingsRepository';
import { GetDailySummaryUseCase } from './GetDailySummaryUseCase';

export class GetReminderDecisionUseCase {
  constructor(
    private readonly getDailySummaryUseCase: GetDailySummaryUseCase,
    private readonly reminderSettingsRepository: ReminderSettingsRepository,
    private readonly timezone: string = 'Europe/Berlin',
    private readonly nowProvider: () => string = () => new Date().toISOString(),
  ) {}

  async execute(dateISO?: string): Promise<ReminderDecision> {
    const nowISO = this.nowProvider();
    const effectiveDateISO = dateISO ?? getDateISOInTimezone(nowISO, this.timezone);
    const [summary, settings] = await Promise.all([
      this.getDailySummaryUseCase.execute(effectiveDateISO),
      this.reminderSettingsRepository.getSettings(),
    ]);

    return decideDailyReminder(nowISO, this.timezone, settings, summary);
  }
}
