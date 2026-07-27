import { runResolverV3047OfflineCandidates } from './runResolverV3047OfflineCandidates';

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(runResolverV3047OfflineCandidates(), null, 2)}\n`);
}
