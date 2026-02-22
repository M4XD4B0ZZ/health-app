export interface ReminderSettings {
  isEnabled: boolean;
  timeLocal: string;
  updatedAt: string;
}

export interface ReminderDecision {
  shouldNotify: boolean;
  reasonCodes: string[];
  plannedAtISO?: string;
  messageDe?: string;
}
