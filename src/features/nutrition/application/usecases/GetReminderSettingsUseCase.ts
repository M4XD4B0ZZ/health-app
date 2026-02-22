import { ReminderSettingsRepository } from '../ports/ReminderSettingsRepository';
import { ReminderSettings } from '../../domain/reminders/ReminderTypes';

export class GetReminderSettingsUseCase {
  constructor(private readonly repository: ReminderSettingsRepository) {}

  async execute(): Promise<ReminderSettings> {
    return this.repository.getSettings();
  }
}
