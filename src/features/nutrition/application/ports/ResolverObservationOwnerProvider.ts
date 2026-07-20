/** Resolves the authenticated private owner outside the observation payload. */
export interface ResolverObservationOwnerProvider {
  getOwnerId(): Promise<string | null>;
}

export class NoopResolverObservationOwnerProvider implements ResolverObservationOwnerProvider {
  async getOwnerId(): Promise<string | null> {
    return null;
  }
}
