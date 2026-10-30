import { describe, expect, it } from "vitest";
import { DICT, translate } from "../../layers/shared/utils/i18n-dict";
import { navAktif } from "../../layers/shared/utils/dashboard-menu";
import { SUBSEKTOR_FALLBACK, warnaSubsektor } from "../../layers/shared/utils/palettes";

describe("i18n", () => {
  it("kamus berisi 143 kunci id dan en yang sama", () => {
    expect(Object.keys(DICT.id)).toHaveLength(143);
    expect(Object.keys(DICT.en).sort()).toEqual(Object.keys(DICT.id).sort());
  });

  it("translate: fallback ke en lalu kunci, dan mengisi {var}", () => {
    expect(translate("id", "nav.switch_to")).toBe("EN");
    expect(translate("en", "nav.switch_to")).toBe("ID");
    expect(translate("id", "tidak.ada")).toBe("tidak.ada");
    expect(translate("en", "footer.copyright", { year: 2026 })).toContain("2026");
  });
});

describe("navAktif", () => {
  it("cocok persis atau awalan dengan garis miring", () => {
    expect(navAktif("/sdi", "/sdi")).toBe(true);
    expect(navAktif("/sdi/wisman", "/sdi")).toBe(true);
    expect(navAktif("/sdikit", "/sdi")).toBe(false);
  });
});

describe("warnaSubsektor", () => {
  it("menormalkan nama dan alias, tak dikenal → abu-abu", () => {
    expect(warnaSubsektor("Kuliner")).toBe("#ed6b23");
    expect(warnaSubsektor("TV & Radio")).toBe("#0369a1");
    expect(warnaSubsektor("Aplikasi & Game Developer")).toBe("#2563eb");
    expect(warnaSubsektor("lainnya")).toBe(SUBSEKTOR_FALLBACK);
  });
});
