import * as Crypto from 'expo-crypto';

/**
 * ACC-003: the single central UUIDv4 generation boundary for every durable, independently
 * synchronizable record identity in the app (Journal entries, Saved Meal templates, the
 * body/metabolism profile). Backed by Expo's own Crypto module — native, cryptographically
 * secure random values on-device (Android/iOS), per the approved ACC-001 architecture
 * decision. IDs are generated locally, before any network access or account creation, and
 * never encode creation time or ordering (RFC4122 v4 is fully random beyond its version/
 * variant bits) — `createdAt`/`updatedAt`/future sync revisions stay separate fields.
 */
export function generateRecordId(): string {
  return Crypto.randomUUID();
}
