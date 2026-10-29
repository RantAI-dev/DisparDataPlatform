// useDatasetBaris di runtime Nuxt (docs/skenario/dataset.md DS-F01, DS-F02, DS-F04, DS-F05).
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { registerEndpoint } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { useDatasetBaris } from "../../layers/dataset/composables/useDatasetBaris";

const envelope = (data: unknown, total: number) => ({ success: true, message: "OK", data, meta: { request_id: "r", total } });
const baris = (n: number, awal = 0) => Array.from({ length: n }, (_, i) => ({ no: awal + i }));
const meta = { slug: "ada", title: "Ada", description: "", sumber_data: [], frekuensi: null, satuan: null, periode: null, medallion: null, total_bronze: 130 };

const panggilan: string[] = [];
registerEndpoint("/_api/dataset/ada/halaman", (event) => {
  panggilan.push(event.path);
  return envelope({ dataset: meta, kolom: { items: [{ key: "no", desc: null, type: null }] }, baris: { items: baris(50) } }, 120);
});
let tundaFilter = 0;
registerEndpoint("/_api/dataset/ada/baris", async (event) => {
  panggilan.push(event.path);
  const sp = new URL(event.path, "http://x").searchParams;
  if (sp.get("q")) return envelope({ items: baris(3, 900) }, 3);
  if (sp.getAll("f[]").includes("no:in:lambat")) {
    await new Promise((ok) => setTimeout(ok, tundaFilter));
    return envelope({ items: baris(1, 700) }, 1);
  }
  if (sp.getAll("f[]").length) return envelope({ items: baris(2, 800) }, 2);
  const page = Number(sp.get("page"));
  return envelope({ items: baris(page === 3 ? 20 : 50, (page - 1) * 50) }, 120);
});
registerEndpoint("/_api/dataset/hilang/halaman", (event) => {
  event.node.res.statusCode = 404;
  return { success: false, message: "Data tidak ditemukan.", errors: { code: "NOT_FOUND" }, meta: { request_id: "r" } };
});

registerEndpoint("/_api/dataset/rusak/halaman", (event) => {
  event.node.res.statusCode = 502;
  return "<html>Bad gateway</html>";
});

const kosongkan = () => panggilan.splice(0);
const jalur = (p: string) => p.replace(/^.*\/_api\//, "");

describe("useDatasetBaris", () => {
  it("DS-F01 muat awal lewat halaman, lalu baris dengan page = dimuat/50 + 1", async () => {
    kosongkan();
    const t = useDatasetBaris(ref("ada"));
    await vi.waitFor(() => expect(t.rows.value).toHaveLength(50));
    expect(t.meta.value?.total_bronze).toBe(130);
    expect([t.count.value, t.hasMore.value]).toEqual([120, true]);

    t.muatBerikutnya();
    await vi.waitFor(() => expect(t.rows.value).toHaveLength(100));
    t.muatBerikutnya();
    await vi.waitFor(() => expect(t.rows.value).toHaveLength(120));
    expect(t.hasMore.value).toBe(false);
    expect(panggilan.map(jalur)).toEqual(["dataset/ada/halaman?page=1&size=50", "dataset/ada/baris?page=2&size=50", "dataset/ada/baris?page=3&size=50"]);
  });

  it("DS-F02 pencarian di-debounce 350 ms dan di-trim: ketikan beruntun = satu request", async () => {
    const t = useDatasetBaris(ref("ada"));
    await vi.waitFor(() => expect(t.rows.value).toHaveLength(50));
    kosongkan();
    for (const v of ["j", "je", "jep", "  jepang  "]) {
      t.q.value = v;
      await new Promise((ok) => setTimeout(ok, 100));
    }
    expect(panggilan).toEqual([]);
    await vi.waitFor(() => expect(t.count.value).toBe(3), { timeout: 2000 });
    expect(panggilan.map(jalur)).toEqual(["dataset/ada/baris?page=1&size=50&q=jepang"]);
    expect([t.filtered.value, t.rows.value[0]]).toEqual([true, { no: 900 }]);
  });

  it("DS-F04 jawaban usang (filter lama yang lambat) dibuang", async () => {
    const t = useDatasetBaris(ref("ada"));
    await vi.waitFor(() => expect(t.rows.value).toHaveLength(50));
    tundaFilter = 300;
    t.filters.value = [{ col: "no", op: "in", values: ["lambat"] }];
    await new Promise((ok) => setTimeout(ok, 20));
    expect(t.refreshing.value).toBe(true);
    t.filters.value = [{ col: "no", op: "in", values: ["cepat"] }];
    await vi.waitFor(() => expect(t.count.value).toBe(2));
    await new Promise((ok) => setTimeout(ok, 400));
    await flushPromises();
    expect([t.count.value, t.rows.value[0], t.refreshing.value]).toEqual([2, { no: 800 }, false]);
  });

  it("DS-F05 slug tak dikenal → teks 404 v2", async () => {
    const t = useDatasetBaris(ref("hilang"));
    await vi.waitFor(() => expect(t.error.value).toBe("Dataset belum tersedia di lakehouse"));
    expect([t.loading.value, t.meta.value]).toEqual([false, null]);
  });

  it("DS-F05 jawaban bukan envelope (gateway mati) → Gagal memuat data", async () => {
    const t = useDatasetBaris(ref("rusak"));
    await vi.waitFor(() => expect(t.error.value).toBe("Gagal memuat data"));
  });
});
