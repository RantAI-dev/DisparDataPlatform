import { describe, expect, it } from "vitest";
import { byPeriod, fmtPeriode, groupCount, groupSum, idfmt, idNum, parseIdNum, topN, total } from "../../layers/shared/utils/format";

describe("format angka Indonesia", () => {
  it("idfmt dan idNum memakai pemisah id-ID", () => {
    expect(idfmt(1234567)).toBe("1.234.567");
    expect(idfmt(51.85)).toBe("51,85");
    expect(idNum(1234.5)).toBe("1.235");
    expect(idNum(3.1, 2)).toBe("3,10");
  });

  it("parseIdNum membaca koma desimal, titik ribuan, dan menolak kosong", () => {
    expect(parseIdNum("51,85")).toBe(51.85);
    // Quirk asli lib/agg.ts (ditiru, K-10): titik diikuti angka selalu dibaca sebagai desimal.
    expect(parseIdNum("1.234,5")).toBe(1.2345);
    expect(parseIdNum("1.234.567")).toBeNull();
    expect(parseIdNum("1.000")).toBe(1);
    expect(parseIdNum("3645837")).toBe(3645837);
    expect(parseIdNum("1,234,567")).toBe(1.234567);
    expect(parseIdNum("12.5")).toBe(12.5);
    expect(parseIdNum("")).toBeNull();
    expect(parseIdNum(null)).toBeNull();
    expect(parseIdNum("abc")).toBe(0);
  });

  it("fmtPeriode hanya mengubah YYYYMM dengan bulan sah", () => {
    expect(fmtPeriode("201801")).toBe("Jan 2018");
    expect(fmtPeriode("202412")).toBe("Des 2024");
    expect(fmtPeriode("202413")).toBe("202413");
    expect(fmtPeriode("2024")).toBe("2024");
  });

  it("agregasi groupSum/groupCount/byPeriod/topN/total", () => {
    const rows = [
      { p: "202402", k: "A", v: "1.000" },
      { p: "202401", k: "B", v: "2,5" },
      { p: "202401", k: "A", v: null },
      { p: null, k: "A", v: "3" },
    ];
    expect(groupSum(rows, "k", "v")).toEqual([{ label: "A", value: 4 }, { label: "B", value: 2.5 }]);
    expect(groupCount(rows, "p")).toEqual([{ label: "202402", value: 1 }, { label: "202401", value: 2 }, { label: "—", value: 1 }]);
    expect(byPeriod(rows, "p").map((x) => x.label)).toEqual(["—", "202401", "202402"]);
    expect(topN([{ label: "a", value: 1 }, { label: "b", value: 3 }, { label: "c", value: 2 }], 2).map((x) => x.label)).toEqual(["b", "c"]);
    expect(total([{ label: "a", value: 1 }, { label: "b", value: 2.5 }])).toBe(3.5);
  });
});
