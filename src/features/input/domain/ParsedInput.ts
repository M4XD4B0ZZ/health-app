export interface ParsedItem {
  name: string
  quantity: number | null
  unit: string | null
  rawText?: string
}

export interface ParsedInput {
  raw: string
  items: ParsedItem[]
}
