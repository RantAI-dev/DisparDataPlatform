import { PariwisataShell, Section } from "@/components/pariwisata/PariwisataShell";
import { rowsFor } from "@/lib/indicator-data";
import { groupSum, byPeriod } from "@/lib/agg";
import { isCatchAll } from "@/lib/pariwisata/parse";
import { RawDataDisclosure } from "@/components/pariwisata/DashboardKit";
import { WismanDashboard, type YearData } from "@/components/pariwisata/WismanDashboard";

export const dynamic = "force-dynamic";

// Datamart bersih (2024–2026). Slug lama basi (2009–2014) sengaja tidak dipakai.
const SLUG_BULAN = "wisman-jakarta-per-bulan";
const SLUG_NEGARA = "wisman-jakarta-per-negara";
const SLUG_PINTU = "wisman-jakarta-per-pintu-masuk"; // arsip 2010/2014, hanya untuk tabel

const yearOf = (r: Record<string, unknown>) =>
  String(r.tahun ?? String(r.periode_data ?? "").slice(0, 4));

/** Bulan (1–12) dari label periode ("YYYY-MM-DD" / "YYYYMM" / "YYYY-MM"). */
const monthNum = (label: string) => {
  const s = String(label).replace(/[^0-9]/g, "");
  if (s.length >= 6) return parseInt(s.slice(4, 6), 10) || 0; // YYYYMM…
  return parseInt(s, 10) || 0;
};
/** Total per kuartal (hanya kuartal yang ada datanya) dari deret bulanan. */
function quartersOf(monthly: { label: string; value: number }[]): { label: string; value: number }[] {
  const q = [0, 0, 0, 0];
  for (const p of monthly) {
    const m = monthNum(p.label);
    if (m >= 1 && m <= 12) q[Math.floor((m - 1) / 3)] += p.value;
  }
  const out: { label: string; value: number }[] = [];
  for (let i = 0; i < 4; i++) if (q[i] > 0) out.push({ label: `Q${i + 1}`, value: q[i] });
  return out;
}

export default async function WisatawanInternasionalPage() {
  const safe = async (s: string) => {
    try {
      return (await rowsFor(s)) as Record<string, unknown>[];
    } catch {
      return [];
    }
  };
  const [bulan, negara, pintu] = await Promise.all([
    safe(SLUG_BULAN),
    safe(SLUG_NEGARA),
    safe(SLUG_PINTU),
  ]);

  const years = [...new Set(bulan.map(yearOf).filter(Boolean))].sort();

  // Praproses per tahun (server-side) → dioper ke komponen interaktif.
  const byYear: Record<string, YearData> = {};
  for (const y of years) {
    const bRows = bulan.filter((r) => yearOf(r) === y);
    const monthly = byPeriod(bRows, "periode_data", "jumlah_kunjungan");
    const total = monthly.reduce((a, p) => a + p.value, 0);
    const peakMonth = monthly.length
      ? monthly.reduce((m, p) => (p.value > m.value ? p : m))
      : null;

    const nRows = negara.filter(
      (r) => String(r.periode_data ?? "").slice(0, 4) === y && !isCatchAll(r.negara)
    );
    const ranked = groupSum(nRows, "negara", "jumlah_kunjungan").sort(
      (a, b) => b.value - a.value
    );
    const topNegara = ranked.slice(0, 5);
    // Donut: top 8 + "Lainnya" = HANYA negara peringkat 9+ (bukan ember catch-all),
    // supaya slice "Lainnya" tidak membengkak & komposisi terbaca.
    const donutTop = ranked.slice(0, 8);
    const sumDonutTop = donutTop.reduce((a, p) => a + p.value, 0);
    const totalReal = ranked.reduce((a, p) => a + p.value, 0);
    const lainnya = Math.max(0, totalReal - sumDonutTop);
    const donutNegara = lainnya > 0 ? [...donutTop, { label: "Lainnya", value: lainnya }] : donutTop;

    byYear[y] = { total, monthly, quarterly: quartersOf(monthly), topNegara, donutNegara, peakMonth, partial: bRows.length < 12 };
  }
  const yearlyTotals = years.map((y) => ({ label: y, value: byYear[y].total }));
  const defaultYear = years.includes("2025") ? "2025" : years[years.length - 1] ?? "";

  return (
    <PariwisataShell
      eyebrow="Cultural Experience · Wisatawan Internasional"
      title="Wisatawan Internasional"
      nilai="2.767.622"
      satuan="Wisatawan"
      tahun="2025"
      catatan="Angka resmi 2.767.622 (BPS 2025). Data bulanan Dispar mencatat 2.754.220 untuk 2025 — selaras. Pilih tahun untuk melihat detail; tren lintas-tahun ada di bawah."
      sumber="jakarta.bps.go.id"
      sumberHref="https://jakarta.bps.go.id"
    >
      <WismanDashboard
        years={years}
        byYear={byYear}
        yearlyTotals={yearlyTotals}
        defaultYear={defaultYear}
      />

      <Section title="Data mentah & sumber" desc="Datamart wisman Jakarta — Dinas Pariwisata & Ekraf.">
        <div className="space-y-3">
          <RawDataDisclosure slug={SLUG_BULAN} title="Wisman per bulan (2024–2026)" count={bulan.length} />
          <RawDataDisclosure slug={SLUG_NEGARA} title="Wisman per negara (s/d 2026)" count={negara.length} />
          <RawDataDisclosure slug={SLUG_PINTU} title="Wisman per pintu masuk (arsip 2010/2014, nasional)" count={pintu.length} />
        </div>
      </Section>
    </PariwisataShell>
  );
}
