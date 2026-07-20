import type { ResolverObservationOwnerProvider } from '../ports/ResolverObservationOwnerProvider';
import type {
  ResolverObservationDeletionPort,
  ResolverObservationDeletionResult,
} from '../ports/ResolverObservationDeletionPort';

export class DeleteResolverObservationsForCurrentOwner {
  constructor(
    private readonly ownerProvider: ResolverObservationOwnerProvider,
    private readonly deletionPort: ResolverObservationDeletionPort,
  ) {}

  async execute(): Promise<ResolverObservationDeletionResult> {
    const ownerId = await this.ownerProvider.getOwnerId();
    if (!ownerId) return { status: 'failed', code: 'missing_owner' };
    return this.deletionPort.deleteForOwner(ownerId);
  }
}
