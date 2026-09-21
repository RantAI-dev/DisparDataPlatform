import { PariwisataShell, Section } from "@/components/pariwisata/PariwisataShell";
import { rowsFor } from "@/lib/indicator-data";
import { groupSum, topN, total } from "@/lib/agg";
import { titleCase } from "@/lib/pariwisata/parse";
import {
  KpiRow,
  Kpi,
  ChartCard,
  ChartGrid,
  RawDataDisclosure,
  PALETTE,
} from "@/components/pariwisata/DashboardKit";
import { BarBreakdown } from "@/components/charts/BarBreakdown";
import { Donut } from "@/components/charts/Donut";

export const dynamic = "force-dynamic";

const SLUG_KEL = "jumlah-restoran-per-kelurahan"; // sebaran per kelurahan (2024 & 2026)
const SLUG_USAHA = "data-usaha-jasa-makanan-dan-minuman-jenis-usaha-restoran-di-dki-jakarta"; // arsip 2014
const SLUG_TRIPADVISOR = "restoran-tripadvisor-jakarta"; // kriteria Kearney: TripAdvisor & Michelin

export default async function KulinerMichelinPage() {
  const safe = async (s: string) => {
    try {
      return (await rowsFor(s)) as Record<string, unknown>[];
    } catch {
      return [];
    }
  };
  const [perKelAll, usaha, tripadvisor] = await Promise.all([
    safe(SLUG_KEL),
    safe(SLUG_USAHA),
    safe(SLUG_TRIPADVISOR),
  ]);

  // Pakai tahun terbaru saja agar tidak dobel antar-tahun.
  const latestYear = perKelAll
    .map((r) => String(r.periode_data ?? "").slice(0, 4))
    .filter(Boolean)
    .sort()
    .at(-1);
  const perKel = perKelAll.filter(
    (r) => String(r.periode_data ?? "").slice(0, 4) === latestYear
  );

  const perWilayah = groupSum(
    perKel.map((r) => ({ wil: titleCase(r.wilayah).replace(/Kota Adm\.?\s*/i, ""), jumlah: r.jumlah })),
    "wil",
    "jumlah"
  ).sort((a, b) => b.value - a.value);
  const topKec = topN(
    groupSum(
      perKel.map((r) => ({ kec: titleCase(r.kecamatan), jumlah: r.jumlah })),
      "kec",
      "jumlah"
    ),
    10
  );
  const totalResto = total(perWilayah);
  const kelurahanTercakup = new Set(perKel.map((r) => r.kelurahan).filter(Boolean)).size;

  return (
    <PariwisataShell
      eyebrow="Cultural Experience · Penawaran Kuliner"
      title="Penawaran Kuliner (Michelin)"
      nilai="0"
      satuan="Restoran Michelin"
      tahun="2025"
      pj="Dinas Pariwisata & Ekraf"
      catatan="Belum ada Michelin Star di Jakarta (2025); Panduan Michelin belum masuk Indonesia. Data pendukung menggambarkan basis kuliner Jakarta (sebaran restoran per kelurahan)."
      sumber="Michelin Guide"
      sumberHref="https://guide.michelin.com"
    >
      <section>
        <KpiRow>
          <Kpi label="Restoran Michelin" value="0" sub="Michelin Guide · 2025" />
          <Kpi label={`Restoran terdata (${latestYear ?? "—"})`} value={totalResto} sub="sebaran per kelurahan" />
          <Kpi label="Kelurahan tercakup" value={kelurahanTercakup} />
          <Kpi label="Wilayah terpadat" value={perWilayah[0]?.label ?? "—"} />
        </KpiRow>
        <div className="mt-4">
          <ChartGrid>
            <ChartCard title="Restoran per wilayah" sub={latestYear}>
              <BarBreakdown data={perWilayah} unit=" resto" />
            </ChartCard>
            <ChartCard title="Top 10 kecamatan" sub={latestYear}>
              <BarBreakdown data={topKec} color={PALETTE[1]} unit=" resto" />
            </ChartCard>
            <ChartCard title="Share per wilayah" sub={latestYear}>
              <Donut data={perWilayah} />
            </ChartCard>
          </ChartGrid>
        </div>
      </section>

      <Section title="Data mentah & sumber" desc="Sumber katalog SDI — Dinas Pariwisata & Ekraf.">
        <div className="space-y-3">
          <RawDataDisclosure slug={SLUG_KEL} title={`Jumlah restoran per kelurahan (${latestYear ?? ""})`} count={perKelAll.length} />
          <RawDataDisclosure slug={SLUG_USAHA} title="Daftar usaha restoran (arsip 2014)" count={usaha.length} />
          <RawDataDisclosure
            slug={SLUG_TRIPADVISOR}
            title="Kuliner TripAdvisor Jakarta (kriteria Kearney: TripAdvisor & Michelin)"
            count={tripadvisor.length}
          />
        </div>
      </Section>
    </PariwisataShell>
  );
}
