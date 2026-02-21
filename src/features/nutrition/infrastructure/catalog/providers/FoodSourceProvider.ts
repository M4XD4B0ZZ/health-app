import { EdgeSearchResponse } from './EdgeSearchTypes';

export interface FoodSourceProvider {
  search(params: { query: string; locale: 'de' | 'en' }): Promise<EdgeSearchResponse>;
}
