export interface ResolverFoodRequest {
  rawName: string
  query: string
  canonicalName: string | null
  quantity: number | null
  unit: string | null
  status: "ready" | "unresolved"
}