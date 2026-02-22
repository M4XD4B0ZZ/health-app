import { ReminderSettingsRepository } from '../../application/ports/ReminderSettingsRepository';
import { KeyValueStore } from '../../application/ports/KeyValueStore';
import { ReminderSettings } from '../../domain/reminders/ReminderTypes';

const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  isEnabled: false,
  timeLocal: '20:00',
  updatedAt: new Date(0).toISOString(),
};

export class PersistedReminderSettingsRepository implements ReminderSettingsRepository {
  private static readonly STORAGE_KEY = 'nutrition:reminderSettings';

  constructor(private readonly keyValueStore: KeyValueStore) {}

  async getSettings(): Promise<ReminderSettings> {
    const raw = await this.keyValueStore.get(PersistedReminderSettingsRepository.STORAGE_KEY);
    if (!raw) {
      return DEFAULT_REMINDER_SETTINGS;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
      return {
        isEnabled: parsed.isEnabled ?? DEFAULT_REMINDER_SETTINGS.isEnabled,
        timeLocal: parsed.timeLocal ?? DEFAULT_REMINDER_SETTINGS.timeLocal,
        updatedAt: parsed.updatedAt ?? DEFAULT_REMINDER_SETTINGS.updatedAt,
      };
    } catch (error) {
      console.error('Failed to parse reminder settings:', error);
      return DEFAULT_REMINDER_SETTINGS;
    }
  }

  async setSettings(settings: ReminderSettings): Promise<void> {
    await this.keyValueStore.set(
      PersistedReminderSettingsRepository.STORAGE_KEY,
      JSON.stringify(settings),
    );
  }
}
