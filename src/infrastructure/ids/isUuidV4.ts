const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * ACC-003: true for a canonical RFC4122 v4 UUID string (correct version nibble `4` and
 * variant bits `8`/`9`/`a`/`b`). Used to tell an already-migrated record apart from a legacy
 * (pre-ACC-003) identifier during the one-time local ID migration.
 */
export function isUuidV4(value: string): boolean {
  return UUID_V4_REGEX.test(value);
}
