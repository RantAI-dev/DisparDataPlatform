// SdiTable (halaman → baris, cari, error), fallback basemap K-9, Kpi, dan PariwisataShell di runtime Nuxt.
import { describe, expect, it, vi } from "vitest";
import { h, nextTick } from "vue";
import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import L from "leaflet";
import SdiTable from "../../layers/shared/components/ui/SdiTable.vue";
import Kpi from "../../layers/shared/components/ui/Kpi.vue";
import PariwisataShell from "../../layers/shared/components/ui/PariwisataShell.vue";
import { addBasemap } from "../../layers/shared/composables/useBasemap";

const envelope = (data: unknown, meta: Record<string, unknown>) => ({ success: true, message: "OK", data, meta: { request_id: "r", ...meta } });
const baris = (n: number, awal = 0) => Array.from({ length: n }, (_, i) => ({ id: awal + i, nama: `Event ${awal + i}`, jumlah: 123456 }));

registerEndpoint("/_api/dataset/ada/halaman", () =>
  envelope(
    { dataset: { total_bronze: 1391 }, kolom: { items: [{ key: "nama", desc: "Nama event", type: "varchar" }, { key: "jumlah", desc: null, type: null }] }, baris: { items: baris(50) } },
    { total: 120 },
  ),
);
registerEndpoint("/_api/dataset/ada/baris", (event) => {
  const q = new URL(event.path, "http://x").searchParams.get("q");
  return q ? envelope({ items: baris(2) }, { total: 2 }) : envelope({ items: baris(50, 50) }, { total: 120 });
});
registerEndpoint("/_api/dataset/hilang/halaman", (event) => {
  event.node.res.statusCode = 404;
  return { success: false, message: "Dataset tidak ditemukan.", errors: { code: "NOT_FOUND" }, meta: { request_id: "r" } };
});

describe("SdiTable", () => {
  it("memuat halaman pertama lewat dataset/{slug}/halaman: kolom, baris, dan total", async () => {
    const w = await mountSuspended(SdiTable, { props: { slug: "ada" } });
    await flushPromises();
    await vi.waitFor(() => expect(w.findAll("tbody tr")).toHaveLength(50));
    expect(w.findAll("thead th").map((t) => t.text())).toEqual(["#", "Nama", "Jumlah"]);
    expect(w.find("thead th[title='Nama event']").exists()).toBe(true);
    expect(w.find("tbody td:last-child").text()).toBe("123.456");
    expect(w.text()).toContain("50 / 120 baris");
    expect(w.text()).toContain("Menampilkan 50 dari 1.391 baris");
    expect(w.text()).toContain("Gulir untuk memuat lebih banyak");
  });

  it("pencarian (debounce) memakai dataset/{slug}/baris dengan q", async () => {
    const w = await mountSuspended(SdiTable, { props: { slug: "ada", columns: ["nama"] } });
    await vi.waitFor(() => expect(w.text()).toContain("50 / 120 baris"));
    await w.find("input").setValue("Event 1");
    // Debounce 350 ms memakai timer sungguhan.
    await vi.waitFor(() => expect(w.text()).toContain("2 / 2 baris (hasil pencarian)"), { timeout: 3000 });
    expect(w.findAll("thead th").map((t) => t.text())).toEqual(["#", "Nama"]);
  });

  it("menampilkan pesan error API dengan tautan ke portal SDI", async () => {
    const w = await mountSuspended(SdiTable, { props: { slug: "hilang" } });
    await vi.waitFor(() => expect(w.text()).toContain("Dataset tidak ditemukan. Coba buka di portal SDI ↗."));
    expect(w.find("a").attributes("href")).toBe("https://satudata.jakarta.go.id/open-data/hilang");
  });
});

describe("addBasemap (K-9)", () => {
  const ukurPeta = () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    return L.map(el, { center: [-6.2, 106.82], zoom: 11 });
  };
  const lapisTile = (map: L.Map) => {
    const urls: string[] = [];
    map.eachLayer((l) => l instanceof L.TileLayer && urls.push((l as unknown as { _url: string })._url));
    return urls;
  };

  it("pindah ke OSM bila tile alas Esri gagal sebelum satu pun termuat", () => {
    const map = ukurPeta();
    addBasemap(L, map);
    const [alas] = (() => { const t: L.TileLayer[] = []; map.eachLayer((l) => l instanceof L.TileLayer && t.push(l)); return t; })();
    expect(lapisTile(map).every((u) => u.includes("arcgisonline"))).toBe(true);
    for (let i = 0; i < 3; i++) alas!.fire("tileerror");
    expect(lapisTile(map)).toEqual(["https://tile.openstreetmap.org/{z}/{x}/{y}.png"]);
  });

  it("tetap Esri bila ada tile yang sudah termuat", () => {
    const map = ukurPeta();
    addBasemap(L, map);
    const t: L.TileLayer[] = [];
    map.eachLayer((l) => l instanceof L.TileLayer && t.push(l));
    t[0]!.fire("tileload");
    for (let i = 0; i < 5; i++) t[0]!.fire("tileerror");
    expect(lapisTile(map)).toHaveLength(2);
    expect(lapisTile(map).every((u) => u.includes("arcgisonline"))).toBe(true);
  });
});

describe("Kpi dan PariwisataShell", () => {
  it("Kpi menulis delta sebagai ▲/▼ di depan sub", async () => {
    expect((await mountSuspended(Kpi, { props: { label: "A", value: 1, delta: -1.84, sub: "vs 2023" } })).text()).toContain("▼ 1,8% vs 2023");
    expect((await mountSuspended(Kpi, { props: { label: "A", value: 1, delta: 0 } })).text()).toContain("▲ 0%");
  });

  it("PariwisataShell tanpa tahun menyembunyikan meta Tahun; sumber tanpa href berwarna emas", async () => {
    const w = await mountSuspended(PariwisataShell, { props: { title: "Judul", nilai: "1", satuan: "x", sumber: "SDJ" }, slots: { default: () => h("i", "isi") } });
    await nextTick();
    expect(w.text()).not.toContain("Tahun:");
    expect(w.text()).toContain("Angka indikator");
    expect(w.text()).not.toContain("Angka indikator 2");
    expect(w.find("a[href='/gci']").text()).toBe("← GCI · Pengalaman Budaya");
    expect(w.text()).toContain("isi");
  });
});
