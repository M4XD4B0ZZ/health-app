/**
 * ACC-003: rewrites `id` on every record using an already-known, already-persisted
 * old-id -> new-id mapping — no new ids are ever generated here. Used both to resume an
 * interrupted migration (reusing the exact mapping that was durably persisted before any
 * destructive rewrite happened) and to rewrite foreign references that point at a migrated
 * record's old id (e.g. a Correction Log entryId, or an embedded snapshot's own id field).
 * A record whose `id` isn't a key in `idMap` is returned unchanged (same object reference).
 */
export function applyIdMap<T extends { id: string }>(
  records: readonly T[],
  idMap: Readonly<Record<string, string>>,
): T[] {
  return records.map((record) => {
    const newId = idMap[record.id];
    return newId ? { ...record, id: newId } : record;
  });
}
