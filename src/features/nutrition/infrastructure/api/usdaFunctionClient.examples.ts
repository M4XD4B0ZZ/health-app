import { callUsdaFunction } from './usdaFunctionClient';

export async function exampleUsdaHealthCheck(): Promise<void> {
  await callUsdaFunction('health', undefined);
}

export async function exampleUsdaSearchApple(): Promise<void> {
  await callUsdaFunction('search', { query: 'apple' });
}
