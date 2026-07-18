import { generateRecordId } from './generateRecordId';
import { isUuidV4 } from './isUuidV4';

export interface AssignMissingUuidsResult<T extends { id: string }> {
  /**
   * Same records, in the same order. Any record whose `id` wasn't already a valid UUIDv4 now
   * has a freshly generated one — every record gets its own independent id, even if several
   * records shared the same legacy id (see `duplicateLegacyIds`); records are never left
   * duplicated post-migration. Records that already had a valid UUIDv4 are returned unchanged
   * (same object reference).
   */
  records: T[];
  /**
   * Maps each distinct legacy (non-UUID) id encountered to the new UUIDv4 assigned to its
   * first occurrence, for rewriting external references (e.g. a Correction Log entryId, or a
   * snapshot's own embedded id). Does not disambiguate duplicate occurrences of the same
   * legacy id — see `duplicateLegacyIds`.
   */
  idMap: Record<string, string>;
  /**
   * Legacy ids that appeared on more than one record. Each occurrence still received its own
   * fresh, independent UUIDv4 above, but an external reference keyed by one of these ids
   * cannot be unambiguously attributed to a specific occurrence — callers must not rewrite
   * such a reference via `idMap` alone (fail closed, per ACC-003's dangling-reference policy).
   */
  duplicateLegacyIds: string[];
  /** False only when every record already had a valid UUIDv4 (a no-op migration pass). */
  changed: boolean;
}

/**
 * ACC-003: the pure, reusable core of the one-time legacy-id migration. Every durable local
 * record repository (Journal entries, Saved Meal templates) that stores records with a
 * top-level `id: string` uses this to assign a stable UUIDv4 to any record that doesn't
 * already have one — deterministically in the sense that a record which already has a valid
 * UUIDv4 is never touched or reassigned; the migration is idempotent by construction once
 * every record has one.
 */
export function assignMissingUuids<T extends { id: string }>(
  records: readonly T[],
): AssignMissingUuidsResult<T> {
  const idMap: Record<string, string> = {};
  const seenLegacyIds = new Set<string>();
  const duplicateLegacyIds: string[] = [];
  let changed = false;

  const migratedRecords = records.map((record) => {
    if (isUuidV4(record.id)) {
      return record;
    }

    changed = true;
    const oldId = record.id;
    const newId = generateRecordId();

    if (seenLegacyIds.has(oldId)) {
      if (!duplicateLegacyIds.includes(oldId)) {
        duplicateLegacyIds.push(oldId);
      }
      // idMap intentionally keeps only the first occurrence's mapping — see
      // `duplicateLegacyIds` doc above.
    } else {
      seenLegacyIds.add(oldId);
      idMap[oldId] = newId;
    }

    return { ...record, id: newId };
  });

  return { records: migratedRecords, idMap, duplicateLegacyIds, changed };
}
