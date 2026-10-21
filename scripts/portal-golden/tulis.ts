/** Penulisan berkas golden yang deterministik (dua kali jalan = byte identik). */
import fs from "node:fs";
import path from "node:path";

/** Satu keluaran golden = respons satu endpoint Data API untuk satu set parameter. */
export type Golden = {
  /** Nama berkas tanpa `.json`. */
  nama: string;
  /** Path Data API (KONTRAK §2). */
  endpoint: string;
  /** Query yang setara dengan keadaan halaman yang direkam. `{}` = default. */
  params: Record<string, string>;
  /** Isi `data` respons. */
  data: unknown;
  /** Bagian `meta` yang deterministik (total, page, size). `generated_at` dkk tidak ikut. */
  meta?: Record<string, unknown>;
};

export function serialisasi(g: Golden): string {
  const isi = { endpoint: g.endpoint, params: g.params, data: g.data, ...(g.meta ? { meta: g.meta } : {}) };
  return JSON.stringify(isi, null, 1) + "\n";
}

/** Tulis semua golden ke `dir`; kembalikan daftar berkas dan ukurannya. */
export function tulisSemua(dir: string, golden: Golden[]): { berkas: string; byte: number }[] {
  fs.mkdirSync(dir, { recursive: true });
  return golden.map((g) => {
    const isi = serialisasi(g);
    const berkas = path.join(dir, `${g.nama}.json`);
    fs.writeFileSync(berkas, isi);
    return { berkas, byte: Buffer.byteLength(isi) };
  });
}

/** Bandingkan golden hitung ulang dengan berkas ter-commit; kembalikan daftar yang beda. */
export function cekSemua(dir: string, golden: Golden[]): string[] {
  const beda: string[] = [];
  const diharapkan = new Set(golden.map((g) => `${g.nama}.json`));
  for (const g of golden) {
    const berkas = path.join(dir, `${g.nama}.json`);
    if (!fs.existsSync(berkas) || fs.readFileSync(berkas, "utf8") !== serialisasi(g)) beda.push(`${g.nama}.json`);
  }
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) if (f.endsWith(".json") && !diharapkan.has(f)) beda.push(`${f} (tidak lagi dihasilkan)`);
  }
  return beda;
}
