export type AppEnvName = 'dev' | 'prod' | 'test' | 'unknown';

function getEnvValue(name: string): string | undefined {
  if (typeof process === 'undefined' || !process?.env) {
    return undefined;
  }

  return process.env[name];
}

function normalizeEnvName(value?: string): AppEnvName | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (normalized === 'dev' || normalized === 'development') {
    return 'dev';
  }

  if (normalized === 'prod' || normalized === 'production') {
    return 'prod';
  }

  if (normalized === 'test') {
    return 'test';
  }

  return undefined;
}

export function envName(): AppEnvName {
  const appEnv = normalizeEnvName(getEnvValue('APP_ENV'));
  if (appEnv) {
    return appEnv;
  }

  const nodeEnv = normalizeEnvName(getEnvValue('NODE_ENV'));
  const isJestWorker = Boolean(getEnvValue('JEST_WORKER_ID'));
  if (nodeEnv === 'test' || isJestWorker) {
    return 'test';
  }

  if (typeof __DEV__ !== 'undefined') {
    return __DEV__ ? 'dev' : 'prod';
  }

  if (nodeEnv) {
    return nodeEnv;
  }

  return 'unknown';
}

export function isDevBuild(): boolean {
  return envName() === 'dev';
}

export function isProdBuild(): boolean {
  return envName() === 'prod';
}

export function isDebugLoggingEnabled(): boolean {
  if (!isDevBuild()) return false;
  return process.env.EXPO_PUBLIC_RESOLVER_DEBUG === 'true';
}
