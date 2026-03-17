const NUMBER_REGEX = /^(\d+)\s+(.*)$/i

export function simpleParse(input: string) {
  const normalized = input
    .toLowerCase()
    .replace(",", " und ")
    .replace("&", " und ")

  const parts = normalized.split(" und ")

  return parts.map((part) => {
    const trimmed = part.trim()
    const match = trimmed.match(NUMBER_REGEX)

    if (match) {
      return {
        name: match[2].trim(),
        quantity: parseInt(match[1], 10),
        unit: null,
      }
    }

    return {
      name: trimmed,
      quantity: null,
      unit: null,
    }
  })
}
