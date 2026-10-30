import { describe, expect, it } from "vitest";
import { tujuanRedirect } from "../../server/utils/redirect-lama";

// Diambil dari `curl -I` ke dispar.rantai.dev, 28 Okt 2026 (laporan plan 10).
const PRODUKSI: Array<[string, 307 | 404, string?]> = [
  ["/atlas", 307, "/spatial"],
  ["/atlas/golf", 307, "/gpci/lapangan-golf"],
  ["/atlas/hotel", 307, "/gpci/hotel"],
  ["/atlas/tidak-ada", 404],
  ["/atlas/golf/map", 307, "/spatial"],
  ["/atlas/restaurants/map", 307, "/spatial"],
  ["/atlas/souvenir/map", 307, "/spatial"],
  ["/atlas/hotel/map", 404],
  ["/atlas/tidak-ada/map", 404],
  ["/gmti/map", 307, "/spatial"],
  ["/katalog/hotel", 307, "/gpci/hotel"],
  ["/readiness", 307, "/gci"],
];

describe("redirect lama", () => {
  it.each(PRODUKSI)("%s → %s %s", (alamat, status, lokasi) => {
    expect(tujuanRedirect(alamat)).toEqual(status === 307 ? { status, lokasi } : { status });
  });

  it("tidak menyentuh alamat biasa", () => {
    for (const alamat of ["/", "/spatial", "/gci", "/atlas/golf/lain", "/gmti", "/katalog"]) {
      expect(tujuanRedirect(alamat)).toBeNull();
    }
  });

  it("tidak tertipu kunci warisan Object (toString, __proto__)", () => {
    expect(tujuanRedirect("/atlas/toString")).toEqual({ status: 404 });
    expect(tujuanRedirect("/atlas/__proto__")).toEqual({ status: 404 });
  });
});
