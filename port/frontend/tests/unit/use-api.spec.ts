import { describe, expect, it } from "vitest";
import { queryLaravel } from "../../layers/shared/composables/useApi";

describe("queryLaravel", () => {
  it("menulis array sebagai kunci[] berulang dan meng-encode nilai", () => {
    expect(queryLaravel({ f: ["negara:in:Jepang", "kota:in:a&b"], page: 2 })).toBe(
      "?f%5B%5D=negara%3Ain%3AJepang&f%5B%5D=kota%3Ain%3Aa%26b&page=2",
    );
  });

  it("membuang nilai kosong", () => {
    expect(queryLaravel({ q: "", x: null, y: undefined, z: [] })).toBe("");
    expect(queryLaravel()).toBe("");
  });
});
