export type ResolverObservationDeletionResult =
  | { status: 'deleted'; count: number }
  | { status: 'failed'; code: 'missing_owner' | 'delete_failed' };

/** Private-only deletion port. It intentionally has neither read nor cross-owner methods. */
export interface ResolverObservationDeletionPort {
  deleteForOwner(ownerId: string): Promise<ResolverObservationDeletionResult>;
}
