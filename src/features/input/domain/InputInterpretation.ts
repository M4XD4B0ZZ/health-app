export type InterpretationType =
  | "single_item"
  | "multi_item"
  | "unknown"

export interface InputInterpretation {
  type: InterpretationType
  itemCount: number
  confidenceLevel: string
  summary: string
}