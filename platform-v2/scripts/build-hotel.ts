/**
 * Bangun datamart GOLD "Hotel & Akomodasi DKI Jakarta" dari data RESMI SDI
 * (Satu Data Jakarta / BPS) — TANPA scraping OTA. Tiga sumber:
 *
 *   1. Rekapitulasi Usaha & Kamar Hotel  → registry per hotel (kamar, golongan,
 *      wilayah, alamat)                    slug: data-jumlah-rekapitulasi-usaha-dan-kamar-hotel
 *   2. Tingkat Penghunian Kamar (TPK)     → okupansi % bulanan per klasifikasi
 *      bintang                             slug: data-rata-rata-tingkat-hunian-kamar-pada-hotel-berbintang-di-provinsi-dki-jakarta
 *   3. Rata-rata Lama Menginap (LoS)      → malam per bulan, per bintang × tamu
 *      (Wisman/Wisnus)                     slug: data-rata-rata-lama-menginap-...-provinsi-dki-jakarta
 *
 * Output:
 *   - platform/data/hotel-jakarta.json  (gold datamart; siap di-load ke lakehouse)
 *   - platform/lib/hotel.ts             (embed + helper untuk view Atlas)
 *
 *   npx tsx scripts/build-hotel.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const BACKEND = "https://satudata.jakarta.go.id/backend/api/v2/satudata";

async function tableData(slug: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let page = 1; page <= 20; page++) {
    let ok = false;
    for (let attempt = 0; attempt < 4 && !ok; attempt++) {
      try {
        const res = await fetch(`${BACKEND}/get-table-data`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            page_url: slug,
            kategori: "dataset",
            page,
            per_page: 5000,
            sort_field: null,
            sort_order: "asc",
            filters: {},
          }),
        });
        const text = await res.text();
        const json = JSON.parse(text);
        const chunk = Array.isArray(json?.data) ? json.data : [];
        out.push(...chunk);
        ok = true;
        if (chunk.length < 5000) return out;
      } catch {
        await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
      }
    }
    if (!ok) throw new Error(`gagal fetch ${slug} page ${page}`);
  }
  return out;
}

/** Angka gaya Indonesia: "51,85" → 51.85 ; "2.577" → 2577. */
function idNum(v: unknown): number | null {
  let s = String(v ?? "").trim();
  if (!s) return null;
  if (s.includes(",") && !/\.\d/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const bintang = (v: unknown) => String(v ?? "").trim().toUpperCase();

async function main() {
  const [recapRaw, tpkRaw, losRaw] = await Promise.all([
    tableData("data-jumlah-rekapitulasi-usaha-dan-kamar-hotel"),
    tableData("data-rata-rata-tingkat-hunian-kamar-pada-hotel-berbintang-di-provinsi-dki-jakarta"),
    tableData(
      "data-rata-rata-lama-menginap-wisatawan-mancanegara-dan-wisatawan-nusantara-pada-hotel-berbintang-di-provinsi-dki-jakarta"
    ),
  ]);

  // Registry = daftar pendaftaran bergulir (tiap hotel dicatat sekali dgn periode
  // saat didaftarkan), BUKAN sensus per-periode. Jadi gabungkan seluruh baris
  // lalu dedup per nama (simpan entri periode terbaru per hotel).
  const recPeriods = [...new Set(recapRaw.map((r) => String(r.periode_data ?? "")))].sort();
  const recLatest = recPeriods[recPeriods.length - 1] ?? "";
  const byName = new Map<string, ReturnType<typeof toHotel>>();
  function toHotel(r: Record<string, unknown>) {
    return {
      nama: String(r.nama_usaha_atau_hotel ?? "").trim(),
      jenis_usaha: String(r.jenis_usaha ?? "").trim() || "HOTEL",
      golongan: String(r.golongan ?? "").trim().toUpperCase(),
      kamar: idNum(r.jumlah_kamar) ?? 0,
      alamat: String(r.alamat ?? "").trim(),
      wilayah: String(r.wilayah ?? "").trim().toUpperCase(),
      periode: String(r.periode_data ?? ""),
    };
  }
  for (const raw of recapRaw) {
    const h = toHotel(raw);
    if (!h.nama) continue;
    const key = h.nama.toUpperCase();
    const prev = byName.get(key);
    if (!prev || h.periode > prev.periode) byName.set(key, h);
  }
  const registry = [...byName.values()].sort((a, b) => a.nama.localeCompare(b.nama, "id"));

  const tpk = tpkRaw
    .map((r) => ({
      periode: String(r.periode_data ?? ""),
      bintang: bintang(r.jenis_hotel),
      nilai: idNum(r.rata_rata),
    }))
    .filter((r) => r.periode && r.bintang && r.nilai != null) as {
    periode: string;
    bintang: string;
    nilai: number;
  }[];

  const los = losRaw
    .map((r) => ({
      periode: String(r.periode_data ?? ""),
      bintang: bintang(r.jenis_hotel),
      tamu: String(r.jenis_tamu ?? "").trim().toUpperCase(),
      nilai: idNum(r.rata_rata),
    }))
    .filter((r) => r.periode && r.tamu && r.nilai != null) as {
    periode: string;
    bintang: string;
    tamu: string;
    nilai: number;
  }[];

  const meta = {
    built: new Date().toISOString().slice(0, 10),
    sources: [
      "Satu Data Jakarta — Rekapitulasi Usaha & Kamar Hotel",
      "Satu Data Jakarta / BPS — Tingkat Penghunian Kamar Hotel Berbintang",
      "Satu Data Jakarta / BPS — Rata-rata Lama Menginap Wisman & Wisnus Hotel Berbintang",
    ],
    registryPeriod: `${recPeriods[0] ?? ""}–${recLatest}`,
    totals: {
      hotels: registry.length,
      rooms: registry.reduce((a, h) => a + h.kamar, 0),
      tpkPeriods: [...new Set(tpk.map((r) => r.periode))].length,
      losPeriods: [...new Set(los.map((r) => r.periode))].length,
    },
  };

  writeFileSync(
    join(process.cwd(), "data", "hotel-jakarta.json"),
    JSON.stringify({ meta, registry, tpk, los }, null, 2) + "\n"
  );

  const ts = `/**
 * Hotel & Akomodasi DKI Jakarta — datamart GOLD dari data RESMI (Satu Data
 * Jakarta / BPS). Dibangun oleh scripts/build-hotel.ts — JANGAN edit manual.
 *
 * TANPA scraping OTA: supply (jumlah usaha & kamar per hotel), okupansi TPK
 * bulanan per klasifikasi bintang, dan Lama Menginap (LoS) Wisman/Wisnus.
 */

export type HotelRow = {
  nama: string;
  jenis_usaha: string;
  golongan: string;
  kamar: number;
  alamat: string;
  wilayah: string;
  periode: string;
};
export type TpkRow = { periode: string; bintang: string; nilai: number };
export type LosRow = { periode: string; bintang: string; tamu: string; nilai: number };

export const HOTEL_META = ${JSON.stringify(meta, null, 2)} as const;
export const HOTEL_REGISTRY: HotelRow[] = ${JSON.stringify(registry)};
export const HOTEL_TPK: TpkRow[] = ${JSON.stringify(tpk)};
export const HOTEL_LOS: LosRow[] = ${JSON.stringify(los)};

export function hotelWilayahList(): string[] {
  return [...new Set(HOTEL_REGISTRY.map((h) => h.wilayah).filter(Boolean))].sort();
}
export function hotelGolonganList(): string[] {
  return [...new Set(HOTEL_REGISTRY.map((h) => h.golongan).filter(Boolean))].sort();
}
`;
  writeFileSync(join(process.cwd(), "lib", "hotel.ts"), ts);

  console.log("hotel gold dibangun:");
  console.log("  registry:", registry.length, "hotel · total kamar", meta.totals.rooms, "· periode", recLatest);
  console.log("  tpk:", tpk.length, "baris ·", meta.totals.tpkPeriods, "periode ·", [...new Set(tpk.map((r) => r.bintang))].join(","));
  console.log("  los:", los.length, "baris ·", meta.totals.losPeriods, "periode ·", [...new Set(los.map((r) => r.tamu))].join(","));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
