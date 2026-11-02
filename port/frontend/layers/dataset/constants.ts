/**
 * Konstanta tampilan fitur dataset (teks dan warna yang ditulis tangan di v2), dengan sumbernya.
 */

/** platform-v2/lib/sdi.ts:24,25 */
export const SDI_ORG_NAME = "Dinas Pariwisata Dan Ekonomi Kreatif";
export const SDI_PORTAL = "https://satudata.jakarta.go.id";

/** Label sumber data katalog (platform-v2/lib/secondary.ts:13-18 @ 464fc15). */
export type SumberData = "sdi" | "internal" | "instansi" | "crawling";
export const SUMBER_DATA: Record<SumberData, string> = {
  sdi: "SDI · Satu Data Jakarta",
  internal: "Data internal Dispar",
  instansi: "Instansi lain",
  crawling: "Crawling",
};

/** platform-v2/components/CatalogView.tsx:14-17 dan app/sdi/[slug]/page.tsx:9-10 */
export const NAVY = "#ed6b23";
export const GOLD = "#f0a13a";
export const GREEN = "#0e7c42";
export const LINK = "#2563eb";

export type Medallion = "bronze" | "silver" | "gold";
export type MedallionInfo = { level: Medallion; table?: string; mart?: string };

type Medal = { label: string; bg: string; fg: string; catatanKatalog: string; catatanDetail: string };

/** Lapisan medallion: catatan katalog (CatalogView.tsx:37-56) dan halaman detail ([slug]/page.tsx:35-54). */
export const MEDAL: Record<Medallion, Medal> = {
  bronze: {
    label: "Bronze",
    bg: "#f6ebe1",
    fg: "#8a5223",
    catatanKatalog: "tersalin apa adanya ke lakehouse (mentah, belum bertipe)",
    catatanDetail: "salinan mentah apa adanya di lakehouse (Apache Iceberg) — belum ada model bertipe",
  },
  silver: {
    label: "Silver",
    bg: "#eef1f5",
    fg: "#4a5a6b",
    catatanKatalog: "sudah dibersihkan & bertipe — inilah yang ditampilkan di halaman dataset",
    catatanDetail: "sudah dibersihkan & bertipe; tabel di halaman ini dibaca dari lapisan Silver",
  },
  gold: {
    label: "Gold",
    bg: "#fbf0d6",
    fg: "#8a6a12",
    catatanKatalog: "sudah dipakai mart penyaji dashboard",
    catatanDetail: "sudah diringkas menjadi mart penyaji yang dibaca dashboard indikator",
  },
};

/** Penjelasan lapisan di kartu bawah katalog (CatalogView.tsx:409-413). */
export const PENJELASAN_LAPISAN: Record<Medallion, string> = {
  bronze:
    "Salinan apa adanya dari sumber (Satu Data Jakarta / berkas pendataan), disimpan dalam format terbuka Apache Iceberg lengkap dengan kolom audit: waktu tarik, alamat sumber, dan nomor batch.",
  silver:
    "Sudah dibersihkan dan bertipe (angka, tanggal, teks) serta diselaraskan dengan dimensi bersama. Baris yang gagal dikonversi masuk karantina, tidak dibuang dan tidak dipakai. Inilah lapisan yang tampil di halaman dataset.",
  gold: "Sudah diringkas menjadi mart penyaji (serving.mart_*) yang dibaca dashboard indikator — mis. wisman, kuliner, event, kunjungan DTW.",
};

/** Kolom yang tidak ditampilkan bila metadata kolom kosong ([slug]/page.tsx:56-66). */
export const KOLOM_TERSEMBUNYI = new Set([
  "id",
  "user_id",
  "uid_upload",
  "batch_upload",
  "jadwal_rilis",
  "tanggal_upload",
  "tanggal_update",
  "created_at",
  "updated_at",
]);

/** Ukuran halaman tabel detail ([slug]/page.tsx:12). */
export const UKURAN_HALAMAN = 50;

/** Pesan error detail: teks 404 route `/api/sdi/[slug]` v2 dan kegagalan jaringan ([slug]/page.tsx:150). */
export const PESAN_404 = "Dataset belum tersedia di lakehouse";
export const PESAN_GAGAL = "Gagal memuat data";
