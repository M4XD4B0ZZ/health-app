import { ReminderSettings } from '../../domain/reminders/ReminderTypes';

export interface ReminderSettingsRepository {
  getSettings(): Promise<ReminderSettings>;
  setSettings(settings: ReminderSettings): Promise<void>;
}
