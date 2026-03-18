import { matchDish } from "../application/matchDish"
import { buildInputInterpretation } from "../application/buildInputInterpretation"

describe("Dish recognition", () => {
  test("exact known dish: Lasagne", () => {
    const input = "Lasagne"
    const dishMatch = matchDish(input)
    expect(dishMatch.status).toBe("matched")

    const interpretation = buildInputInterpretation({ raw: input, items: [{ name: input, quantity: null, unit: null }] }, [], { level: "high", score: 1, reason: "test" })
    expect(interpretation.type).toBe("dish")
  })

  test("another known dish: spaghetti bolognese", () => {
    const input = "spaghetti bolognese"
    const interpretation = buildInputInterpretation({ raw: input, items: [{ name: input, quantity: null, unit: null }] }, [], { level: "high", score: 1, reason: "test" })
    expect(interpretation.type).toBe("dish")
  })

  test("non-dish multi-item input: 2 Eier und Toast", () => {
    const input = "2 Eier und Toast"
    const interpretation = buildInputInterpretation({ raw: input, items: [
      { name: "2 Eier", quantity: null, unit: null },
      { name: "Toast", quantity: null, unit: null }
    ] }, [], { level: "high", score: 1, reason: "test" })
    expect(interpretation.type).toBe("multi_item")
  })

  test("unknown input: mysteryfood", () => {
    const input = "mysteryfood"
    const interpretation = buildInputInterpretation({ raw: input, items: [{ name: input, quantity: null, unit: null }] }, [], { level: "high", score: 1, reason: "test" })
    expect(interpretation.type).not.toBe("dish")
  })
})
