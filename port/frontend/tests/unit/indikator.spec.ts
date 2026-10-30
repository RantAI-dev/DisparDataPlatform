// Fitur indikator, logika murni (docs/skenario/indikator.md IN-F01..F03).
import { describe, expect, it } from "vitest";
import { kelompokkanBlok, uraiSelArtis } from "../../layers/indikator/utils/indikator";
import { bulanLabel } from "../../layers/indikator/constants";
import type { Blok } from "../../layers/indikator/composables/useIndikator";

const b = (type: Blok["type"], layout: Blok["layout"], title = type): Blok => ({ type, layout, title, data: [] });

describe("indikator", () => {
  it("IN-F01 blok setengah berurutan digabung; batang setengah hijau lalu kuning", () => {
    const g = kelompokkanBlok([b("bar", "full", "a"), b("bar", "half", "b"), b("bar", "half", "c"), b("line", "full", "d")]);
    expect(g.map((x) => (x.full ? x.full.title : x.half!.map((h) => `${h.blok.title}:${h.warna}`).join(",")))).toEqual(["a", "b:#0e7c42,c:#e8a33d", "d"]);
    const arketipeA = kelompokkanBlok([b("map_points", "full"), b("ranked", "half"), b("donut", "half"), b("line", "full")]);
    expect(arketipeA[1]!.half!.map((h) => h.warna)).toEqual([undefined, undefined]);
  });

  it("IN-F02 sel peringkat artis diurai: nama, ✓ tampil di Jakarta, negara", () => {
    expect(uraiSelArtis("Ed Sheeran ✓ · Inggris")).toEqual({ artis: "Ed Sheeran", ceklis: true, negara: "Inggris" });
    expect(uraiSelArtis("Bad Bunny · Puerto Rico (Amerika Serikat)")).toEqual({ artis: "Bad Bunny", ceklis: false, negara: "Puerto Rico (Amerika Serikat)" });
    expect(uraiSelArtis("Drake")).toEqual({ artis: "Drake", ceklis: false, negara: null });
  });

  it("IN-F03 bulanLabel lib/pariwisata/parse.ts", () => {
    expect([bulanLabel("2025-08-01"), bulanLabel("202401"), bulanLabel("3"), bulanLabel("")]).toEqual(["Agu '25", "Jan '24", "Mar", ""]);
  });
});
