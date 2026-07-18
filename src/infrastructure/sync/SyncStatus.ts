/**
 * ACC-004: the local sync-status states a durable, independently synchronizable record can
 * be in. These are exactly the six states already approved in the ACC-001 architecture plan
 * (`plans/ACC-001_LOCAL_FIRST_ACCOUNT_BACKUP_SYNC_PLAN.md` §20, "Sync-status UX") — this is
 * not a new abstraction, just the internal identifier for a UI vocabulary already decided.
 * Nothing in this task (or before Phase 2 exists) ever assigns this field; it stays
 * `undefined` on every record until a future sync engine populates it.
 *
 * | Value                       | §20 German label                  |
 * | ---------------------------- | ---------------------------------- |
 * | `local_only`                 | „Nur auf diesem Gerät"             |
 * | `synced`                      | „Gesichert"                        |
 * | `syncing`                     | „Synchronisierung läuft"           |
 * | `pending`                     | „Änderungen ausstehend"            |
 * | `failed`                      | „Synchronisierung fehlgeschlagen"  |
 * | `account_action_required`     | „Kontoaktion erforderlich"         |
 */
export type SyncStatus =
  | 'local_only'
  | 'synced'
  | 'syncing'
  | 'pending'
  | 'failed'
  | 'account_action_required';
