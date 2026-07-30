/**
 * RESOLVER-V3-048 Phase B1 post-merge remediation ("Plattformneutrale Authorization Storage Keys").
 *
 * `authorizationId` remains, completely unchanged, the identity used in records, hashes, and every
 * lease/authorization equality check throughout this protocol -- this module derives a SEPARATE key
 * used only where an authorization ID becomes a filesystem path component: Execution Lease
 * directories/versions, lease crash detection, the Artifact Store's authorization-consumption marker,
 * and crash recovery. All four call sites must derive that path component through this one function,
 * never independently.
 *
 * Windows forbids `:` (and a handful of other characters) in both file and directory names; a real,
 * maintainer-issued `authorizationId` may legitimately contain `:`, spaces, or non-ASCII text, and
 * pre-existing authorization IDs in this codebase already do (e.g. `` `mini-run-development:${hash}` ``).
 *
 * The key is a full base64url (RFC 4648 SS5) re-encoding of the UTF-8 bytes of `authorizationId` --
 * deliberately NOT a character-substitution scheme (e.g. replacing `:` with `_`), which is not
 * collision-resistant (`"a:b"` and `"a_b"` would otherwise collide on the same storage key).
 * base64url is a lossless, injective (collision-free) encoding: distinct inputs always produce
 * distinct outputs, and its alphabet (`A-Z`, `a-z`, `0-9`, `-`, `_`) is a valid path-component
 * character set on Windows, Linux, and macOS alike.
 */
export function deriveProtocolV4AuthorizationStorageKey(authorizationId: string): string {
  if (!authorizationId) throw new Error('PROTOCOL_V4_STORAGE_KEY_EMPTY_AUTHORIZATION_ID');
  return Buffer.from(authorizationId, 'utf-8').toString('base64url');
}
