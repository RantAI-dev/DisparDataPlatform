/**
 * Skrip golden portal — oracle paritas Data API (SPEC §3.6 lapis 1, plan 01).
 *
 * Menjalankan logika Next.js yang tayang (fungsi `lib/*` dan komponen client asli yang
 * dirender di Node) lalu menyimpan hasilnya dalam bentuk respons endpoint Data API.
 *
 * Jalankan dari platform-v2/:
 *   ./node_modules/.bin/tsx --tsconfig ../scripts/tsconfig.portal-golden.json \
 *     --env-file=.env.local ../scripts/portal_golden.tsx [--live] [--check]
 *
 *   (bawaan)  tulis golden STATIS ke lakehouse/data-api/tests/golden/*.json (di-commit)
 *   --check   keluar ≠ 0 bila golden statis ter-commit berbeda dari hasil hitung ulang
 *   --live    tulis golden LIVE (sumber Silver/serving di ClickHouse) ke
 *             lakehouse/data-api/tests/golden/live/ (gitignore, ada cap waktu)
 *
 * platform-v2/ tidak diubah: skrip ini hanya mengimpor dan merender.
 */
import "./portal-golden/alias";
import path from "node:path";
import { goldenStatis } from "./portal-golden/statis";
import { cekSemua, tulisSemua } from "./portal-golden/tulis";

const DIR = path.resolve(__dirname, "../lakehouse/data-api/tests/golden");

// Server Dispar sudah pindah ke .148; env lama bisa masih menunjuk .187.
if (process.env.CH_URL?.includes("192.168.18.187")) {
  process.env.CH_URL = process.env.CH_URL.replace("192.168.18.187", "192.168.18.148");
}

async function main(): Promise<number> {
  const arg = new Set(process.argv.slice(2));
  const statis = await goldenStatis();

  if (arg.has("--check")) {
    const beda = cekSemua(DIR, statis);
    if (beda.length) {
      console.error(`golden statis berbeda (${beda.length}):\n  ${beda.join("\n  ")}`);
      return 1;
    }
    console.log(`golden statis cocok: ${statis.length} berkas`);
  } else if (!arg.has("--live")) {
    for (const f of tulisSemua(DIR, statis)) console.log(`${path.relative(process.cwd(), f.berkas)}  ${f.byte} B`);
  }

  if (arg.has("--live")) {
    const { goldenLive } = await import("./portal-golden/live");
    const dirLive = path.join(DIR, "live");
    for (const f of tulisSemua(dirLive, await goldenLive())) console.log(`${path.relative(process.cwd(), f.berkas)}  ${f.byte} B`);
  }
  return 0;
}

main().then(
  (kode) => process.exit(kode),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
