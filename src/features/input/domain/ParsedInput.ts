export interface ParsedItem {
  name: string
  quantity: number | null
  unit: string | null
}

export interface ParsedInput {
  raw: string
  items: ParsedItem[]
}
