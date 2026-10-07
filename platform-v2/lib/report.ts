import { unstable_cache } from "next/cache";
import { INDICATORS } from "@/lib/gci/indicators";
import { computeReadiness, type IndicatorResult } from "@/lib/gci/readiness";
import { datasetsFor, rowsForRaw } from "@/lib/indicator-data";
import { getReportRaw, putReport } from "@/lib/report-store";

/**
 * Report terprecompute. Halaman membaca snapshot kecil ini alih-alih men-scan
 * tabel `record` (besar) tiap request — hemat egress + kompute Neon, dan
 * membuat halaman GCI/GPCI cepat (tanpa hitung ulang).
 * Diisi ulang oleh job terjadwal: `GET/POST /api/admin/report` (cron harian)
 * atau setelah sync data (scripts/db-build-report.ts).
 */

/** Dataset di atas ambang ini tidak di-snapshot (hindari blob raksasa). */
const ROWS_CAP = 6000;

// Cache bersama GCI/GPCI, diisi saat runtime dan diperbarui setiap 24 jam.
const cachedReadiness = unstable_cache(computeReadiness, ["gci-gpci-readiness"], {
  revalidate: 86400,
});

/**
 * Baca snapshot bila tersedia, lalu cache hasil lakehouse yang berhasil.
 * Kegagalan pembacaan ditangani di luar cache agar tidak disimpan 24 jam.
 */
export async function getReadiness(): Promise<IndicatorResult[]> {
  const snap = await getReportRaw<IndicatorResult[]>("readiness");
  if (snap?.data?.length) return snap.data;
  try {
    return await cachedReadiness();
  } catch {
    return [];
  }
}

/**
 * Bangun ulang semua report dari data mentah (BERAT — scan `record`).
 * Hanya dipanggil oleh job terjadwal, TIDAK di jalur request.
 * - `readiness`  : status + nilai tiap indikator (halaman list GCI/GPCI).
 * - `rows:<slug>`: baris dataset yang dipakai komponen indikator (halaman detail).
 */
export async function buildReports(): Promise<{
  readiness: number;
  datasets: number;
}> {
  const readiness = await computeReadiness();
  await putReport("readiness", readiness);

  // Kumpulkan dataset yang dipakai indikator (di bawah cap) lalu snapshot.
  const slugs = new Set<string>();
  for (const ind of INDICATORS) {
    const ds = await datasetsFor(ind.code);
    for (const d of ds) if (d.total > 0 && d.total <= ROWS_CAP) slugs.add(d.slug);
  }
  let n = 0;
  for (const slug of slugs) {
    const rows = await rowsForRaw(slug);
    await putReport(`rows:${slug}`, rows);
    n++;
  }
  return { readiness: readiness.length, datasets: n };
}
