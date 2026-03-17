import { ParsedInput } from "../domain/ParsedInput"
import { simpleParse } from "../infrastructure/simpleParser"

export function parseInput(raw: string): ParsedInput {
  const items = simpleParse(raw)

  return {
    raw,
    items,
  }
}
