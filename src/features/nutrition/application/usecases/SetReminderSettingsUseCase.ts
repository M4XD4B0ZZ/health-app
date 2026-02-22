import { ReminderSettingsRepository } from '../ports/ReminderSettingsRepository';
import { ReminderSettings } from '../../domain/reminders/ReminderTypes';

export interface SetReminderSettingsInput {
  isEnabled: boolean;
  timeLocal: string;
}

export class SetReminderSettingsUseCase {
  constructor(private readonly repository: ReminderSettingsRepository) {}

  async execute(input: SetReminderSettingsInput): Promise<ReminderSettings> {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(input.timeLocal)) {
      throw new Error('Invalid time format. Expected HH:mm.');
    }

    const settings: ReminderSettings = {
      isEnabled: input.isEnabled,
      timeLocal: input.timeLocal,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.setSettings(settings);
    return settings;
  }
}
