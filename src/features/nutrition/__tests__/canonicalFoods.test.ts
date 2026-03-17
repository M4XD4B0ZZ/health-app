
import { detectCanonicalEntity } from "../domain/detectCanonicalEntity";

describe("detectCanonicalEntity", () => {
  it("should detect 'ei' as egg", () => {
    expect(detectCanonicalEntity("ei")?.id).toBe("egg");
  });

  it("should detect 'eier' as egg", () => {
    expect(detectCanonicalEntity("eier")?.id).toBe("egg");
  });

  it("should detect 'egg' as egg", () => {
    expect(detectCanonicalEntity("egg")?.id).toBe("egg");
  });

  it("should detect 'eggs' as egg", () => {
    expect(detectCanonicalEntity("eggs")?.id).toBe("egg");
  });

  it("should return null for unknown food", () => {
    expect(detectCanonicalEntity("unknownfood")).toBeNull();
  });
});
