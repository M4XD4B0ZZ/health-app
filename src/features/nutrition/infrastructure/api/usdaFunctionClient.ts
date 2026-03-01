export type UsdaFunctionMode = 'health' | 'search';

import { supabase } from '../../../../infrastructure/supabase/supabaseClient';

export async function callUsdaFunction<T>(
  mode: UsdaFunctionMode,
  payload: Record<string, unknown> | undefined,
): Promise<T | null> {
  const { data, error } = await supabase.functions.invoke('food-usda-search', {
    body: { mode, ...(payload ?? {}) },
  });

  if (error) {
    throw new Error(`USDA Function Error: ${error.message}`);
  }

  return data as T;
}
