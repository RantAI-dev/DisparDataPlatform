// Fitur dataset, logika murni (docs/skenario/dataset.md DS-F03, DS-F06, DS-F07, DS-F08).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { denganFilter, parseQueryBaris, queryBaris, type RowQuery } from "../../layers/dataset/utils/query-filter";
import { fmtRentangPeriode, fmtSel, humanizeKolom, labelChip, labelTautan } from "../../layers/dataset/utils/dataset-format";
import { AWALAN_SIMPAN, buildOption, isNumericCol, muatGrafik, pickDefaultDim, simpanGrafik, sortPoints } from "../../layers/dataset/utils/chart-builder";
import { dariOpenApi } from "../../scripts/docs-dari-openapi";

describe("DS-F03 serialisasi filter", () => {
  const rq: RowQuery = {
    search: "jepang",
    filters: [
      { col: "kebangsaan", op: "in", values: ["JEPANG", "MALAYSIA"] },
      { col: "jumlah", op: "range", min: "100", max: "" },
      { col: "periode_data", op: "range", min: "", max: "2025-12-01" },
    ],
    sort: { col: "jumlah_kunjungan", dir: "desc" },
  };

  it("menulis q, f berulang, dan sort seperti rowQueryParams v2", () => {
    expect(queryBaris(rq)).toEqual({
      q: "jepang",
      f: ["kebangsaan:in:JEPANG", "kebangsaan:in:MALAYSIA", "jumlah:range:100..", "periode_data:range:..2025-12-01"],
      sort: "jumlah_kunjungan:desc",
    });
    expect(queryBaris({ search: "", filters: [], sort: null })).toEqual({});
  });

  it("bolak-balik: parseQueryBaris(queryBaris(x)) = x", () => {
    expect(parseQueryBaris(queryBaris(rq))).toEqual(rq);
  });

  it("nilai in ganda dilebur, sort tanpa arah diabaikan, nilai berisi titik dua utuh", () => {
    expect(parseQueryBaris({ f: ["a:in:x", "a:in:x", "a:in:y:z"], sort: "a" })).toEqual({
      search: "",
      filters: [{ col: "a", op: "in", values: ["x", "y:z"] }],
      sort: null,
    });
  });

  it("denganFilter mengganti atau menghapus filter satu kolom", () => {
    const f = rq.filters;
    expect(denganFilter(f, "jumlah", null).map((x) => x.col)).toEqual(["kebangsaan", "periode_data"]);
    expect(denganFilter(f, "kebangsaan", { col: "kebangsaan", op: "in", values: ["X"] }).at(-1)).toEqual({ col: "kebangsaan", op: "in", values: ["X"] });
  });
});

describe("DS-F07 format tampilan", () => {
  it("fmtRentangPeriode: bulan singkat, tahun apa adanya, satu titik bila sama", () => {
    expect(fmtRentangPeriode({ min: "2024-01-01", max: "2026-07-01" })).toBe("Jan 2024 – Jul 2026");
    expect(fmtRentangPeriode({ min: "2025", max: "2025" })).toBe("2025");
    expect(fmtRentangPeriode({ min: "2025-08-01", max: "2025-08-01" })).toBe("Agu 2025");
  });

  it("fmtSel: kosong → —, digit > 4 diformat id-ID, tahun dibiarkan", () => {
    expect([fmtSel(null), fmtSel(""), fmtSel("2024"), fmtSel("162594340999"), fmtSel(48421), fmtSel("12.5")]).toEqual([
      "—",
      "—",
      "2024",
      "162.594.340.999",
      "48.421",
      "12.5",
    ]);
  });

  it("labelTautan sesuai kunci kolom (renderCell v2)", () => {
    expect(labelTautan("gmaps", "https://maps.google.com/x")).toBe("Peta ↗");
    expect(labelTautan("url_tripadvisor", "https://x")).toBe("TripAdvisor ↗");
    expect(labelTautan("sumber", "http://x")).toBe("Sumber ↗");
    expect(labelTautan("situs_web", "https://x")).toBe("Buka ↗");
    expect(labelTautan("nama", "Bukan URL")).toBeNull();
  });

  it("label chip: dua nilai ditulis, lebih dari dua dihitung, rentang terbuka …", () => {
    expect(labelChip({ col: "kebangsaan", op: "in", values: ["JEPANG", "MALAYSIA"] })).toBe("Kebangsaan: JEPANG, MALAYSIA");
    expect(labelChip({ col: "kebangsaan", op: "in", values: ["A", "B", "C", "D", "E"] })).toBe("Kebangsaan: 5 nilai");
    expect(labelChip({ col: "jumlah_kunjungan", op: "range", min: "", max: "500" })).toBe("Jumlah Kunjungan: … – 500");
    expect(humanizeKolom("periode_data")).toBe("Periode Data");
  });
});

describe("DS-F06 chart builder", () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ periode_data: `2025-${(i % 12) + 1}-01`, kebangsaan: `N${i % 8}`, jumlah: String(i * 10), kbli: "55101" }));

  it("isNumericCol: kolom waktu/kategori/kbli bukan ukuran, angka tersampel ya", () => {
    const k = (key: string, type: string | null = null) => ({ key, desc: null, type });
    expect(isNumericCol(k("jumlah"), rows)).toBe(true);
    expect(isNumericCol(k("kbli"), rows)).toBe(false);
    expect(isNumericCol(k("periode_data"), rows)).toBe(false);
    expect(isNumericCol(k("nilai", "Float64"), [])).toBe(true);
  });

  it("pickDefaultDim memilih kardinalitas terdekat 8", () => {
    expect(pickDefaultDim([{ key: "periode_data", desc: null, type: null }, { key: "kebangsaan", desc: null, type: null }], rows)).toBe("kebangsaan");
  });

  it("sortPoints: batang top-30 nilai turun, garis urut kategori numerik", () => {
    const p = Array.from({ length: 40 }, (_, i) => ({ name: String(40 - i), value: i }));
    const bar = sortPoints(p, "bar", "auto");
    expect(bar).toHaveLength(30);
    expect(bar[0]!.value).toBe(39);
    expect(sortPoints(p, "line", "auto").map((x) => x.name).slice(0, 3)).toEqual(["1", "2", "3"]);
    expect(sortPoints(p, "bar", "kategori_desc")[0]!.name).toBe("30");
    expect(buildOption({ id: "c", kind: "pie", x: "a", y: "b", agg: "sum", sort: "auto" }, []).empty).toBe(true);
  });

  it("preferensi tersimpan: kunci sama dengan v2, entri tak valid dibuang, sort lama → auto", () => {
    expect(AWALAN_SIMPAN).toBe("dispar:dataset-charts:");
    const valid = new Set(["kebangsaan", "jumlah"]);
    const raw = JSON.stringify([
      { kind: "bar", x: "kebangsaan", y: "jumlah", agg: "sum" },
      { kind: "radar", x: "kebangsaan", y: "jumlah", agg: "sum" },
      { kind: "pie", x: "hilang", y: "", agg: "count" },
      { kind: "line", x: "kebangsaan", y: "", agg: "count", sort: "nilai_asc" },
    ]);
    const g = muatGrafik(raw, valid);
    expect(g.map(({ kind, sort }) => [kind, sort])).toEqual([
      ["bar", "auto"],
      ["line", "nilai_asc"],
    ]);
    expect(JSON.parse(simpanGrafik(g)!)).toEqual([
      { kind: "bar", x: "kebangsaan", y: "jumlah", agg: "sum", sort: "auto" },
      { kind: "line", x: "kebangsaan", y: "", agg: "count", sort: "nilai_asc" },
    ]);
    expect(simpanGrafik([])).toBeNull();
    expect(muatGrafik("{rusak", valid)).toEqual([]);
  });
});

describe("DS-F08 isi /docs dari OpenAPI", () => {
  const api = JSON.parse(readFileSync(new URL("../../../docs/api/laravel-openapi.json", import.meta.url), "utf8"));
  const endpoints = JSON.parse(readFileSync(new URL("../../layers/docs/data/endpoints.json", import.meta.url), "utf8"));

  it("endpoints.json = hasil skrip atas ekspor Scramble yang di-commit (jalankan `npm run docs:api`)", () => {
    expect(endpoints).toEqual(dariOpenApi(api));
  });

  it("rute sistem/* tidak tampil; parameter dan contoh terisi", () => {
    expect(endpoints.some((e: { path: string }) => e.path.includes("/sistem/"))).toBe(false);
    const baris = endpoints.find((e: { id: string }) => e.id === "dataset-baris");
    expect(baris.params.map((p: { name: string }) => p.name)).toEqual(["slug", "page", "size", "sort", "q", "f[]"]);
    expect(baris.params.every((p: { desc: string }) => p.desc)).toBe(true);
    expect(endpoints.find((e: { id: string }) => e.id === "dataset-agregat").contoh).toMatch(/\/agregat\?x=kebangsaan&agg=count$/);
  });
});
