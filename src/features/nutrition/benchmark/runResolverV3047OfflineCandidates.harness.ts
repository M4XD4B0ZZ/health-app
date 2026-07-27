import { runResolverV3047OfflineCandidates } from './runResolverV3047OfflineCandidates';

if (require.main === module) {
  void runResolverV3047OfflineCandidates().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });
}
