import { isMockResolverSourceLabel } from '../../../features/nutrition/application/services/ResolverSourceLabel';

const SECURITY_ERROR =
  'SECURITY: Production build configuration must not include mock resolver sources.';

describe('Container Release Airbag', () => {
  const originalAppEnv = process.env.APP_ENV;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.resetModules();
    process.env.APP_ENV = 'prod';
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env.APP_ENV = originalAppEnv;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('does not register mock resolver sources in prod config', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../supabase/supabaseClient', () => ({
        supabase: {
          functions: {
            invoke: jest.fn(),
          },
        },
      }));

      const { getRegisteredResolverSourcesForDiagnostics } = await import('../container');
      const labels = getRegisteredResolverSourcesForDiagnostics();
      const hasMockSources = labels.some((label) => isMockResolverSourceLabel(label));

      if (hasMockSources) {
        throw new Error(SECURITY_ERROR);
      }

      expect(hasMockSources).toBe(false);
    });
  });
});
