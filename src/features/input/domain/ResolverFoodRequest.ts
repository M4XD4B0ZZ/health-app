export interface ResolverFoodRequest {
  rawName: string;
  rawText?: string;
  query: string;
  canonicalName: string | null;
  quantity: number | null;
  unit: string | null;
  status: 'ready' | 'unresolved';
  groupId?: string;
  groupLabel?: string;
}
