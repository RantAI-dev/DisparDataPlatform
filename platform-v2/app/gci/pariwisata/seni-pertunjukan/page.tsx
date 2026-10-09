import Link from "next/link";
import { PariwisataShell, Section } from "@/components/pariwisata/PariwisataShell";
import { rowsFor } from "@/lib/indicator-data";
import { groupCount, groupSum, byPeriod, topN } from "@/lib/agg";
import { wilayahFromAddress, playedArtists } from "@/lib/pariwisata/parse";
import { appearanceFor } from "@/lib/pariwisata/jakarta-appearances";
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
import { LineTrend } from "@/components/charts/LineTrend";
import { TahunFilter } from "@/components/pariwisata/TahunFilter";
import { VenueMapClient } from "@/components/pariwisata/VenueMapClient";
import type { Venue } from "@/components/pariwisata/VenueMap";
import seniVenues from "@/lib/pariwisata/seni-venues.json";

// Render live dari DB tiap request (build image tanpa DB) — hindari SSG kosong.
export const dynamic = "force-dynamic";

const ACCENT = "#ed6b23";

// Dataset pendukung — juga jadi korpus nama-event untuk cek kehadiran artis.
const PENDUKUNG: { slug: string; label: string; eventKey: string }[] = [
  { slug: "data-penyelenggaraan-event-pariwisata-dan-budaya-dki-jakarta", label: "Penyelenggaraan Event Pariwisata & Budaya", eventKey: "kegiatan" },
  { slug: "data-event-pariwisata-dan-kebudayaan-dki-jakarta-2011-2019", label: "Event Pariwisata & Kebudayaan 2011–2019", eventKey: "nama_event" },
  { slug: "data-rekomendasi-penyelenggaraan-pertunjukan-musik", label: "Rekomendasi Penyelenggaraan Pertunjukan Musik", eventKey: "nama_kegiatan" },
];

type ArtisRow = {
  tahun?: string;
  chart?: string;
  peringkat?: string | number;
  artis?: string;
  negara_asal?: string;
  sumber?: string;
};

const CHARTS = [
  { key: "Billboard Year-End Top Artists", label: "Billboard Year-End Top Artists" },
  { key: "Spotify Global Year-End", label: "Spotify Global Year-End" },
];

export default async function SeniPertunjukanPage({
  searchParams,
}: {
  searchParams: Promise<{ tahun?: string }>;
}) {
  const { tahun: tahunParam } = await searchParams;
  const safe = async (s: string) => {
    try {
      return (await rowsFor(s)) as Record<string, unknown>[];
    } catch {
      return [];
    }
  };

  const [artisRaw, seniAll, pen, ev1119, rekom, penyelAll] = await Promise.all([
    safe("artis-top-global-chart"),
    safe("data-seni-pertunjukan-dan-visual"),
    safe(PENDUKUNG[0].slug),
    safe(PENDUKUNG[1].slug),
    safe(PENDUKUNG[2].slug),
    safe("jumlah-penyelenggaraan-event"),
  ]);
  const artis = artisRaw as ArtisRow[];

  // ── Filter tahun (opsi diturunkan dari tahun pada data event) ──
  const tahunOpsi = Array.from(
    new Set(
      [...seniAll.map((r) => r.periode_data), ...penyelAll.map((r) => r.periode_data)]
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
    )
  ).sort();
  const tahun = tahunParam && tahunOpsi.includes(tahunParam) ? tahunParam : "";
  const inTahun = (v: unknown) => !tahun || String(v ?? "").trim() === tahun;
  const seni = seniAll.filter((r) => inTahun(r.periode_data));
  const penyel = penyelAll.filter((r) => inTahun(r.periode_data));

  // ── Agregasi visual ──
  // Tren penyelenggaraan event (semua) per bulan, 2024–2025 (seri hitung bersih).
  const eventBulanan = byPeriod(
    penyel.map((r) => ({
      periode: `${r.periode_data}${String(r.bulan_penyelenggaraan ?? "").padStart(2, "0")}`,
      jumlah_event: r.jumlah_event,
    })),
    "periode",
    "jumlah_event"
  );
  const eventPerTahun = groupSum(penyel, "periode_data", "jumlah_event").sort((a, b) =>
    a.label.localeCompare(b.label)
  );
  // Periode kartu tren: tahun terpilih, atau rentang min–maks tahun pada data yang tampil.
  const tahunData = eventPerTahun.map((r) => r.label).filter(Boolean);
  const periodeEvent = tahun
    ? tahun
    : tahunData.length > 1
      ? `${tahunData[0]}–${tahunData[tahunData.length - 1]}`
      : tahunData[0] ?? "semua tahun";
  const topVenue = topN(groupCount(seni, "nama_venue"), 10);
  const perWilayah = groupCount(
    seni.map((r) => ({ wil: wilayahFromAddress(r.lokasi_venue) })),
    "wil"
  ).sort((a, b) => b.value - a.value);
  const eventTotal = penyel.reduce((a, r) => a + (Number(r.jumlah_event) || 0), 0);
  const venueUnik = new Set(seni.map((r) => r.nama_venue).filter(Boolean)).size;

  // ── Korpus nama-event Jakarta (2010–2025) untuk cek kehadiran artis ──
  const corpus: string[] = [
    ...seniAll.map((r) => r.nama_event),
    ...ev1119.map((r) => r.nama_event),
    ...pen.map((r) => r.kegiatan),
    ...rekom.map((r) => r.nama_kegiatan),
  ]
    .map((x) => String(x ?? ""))
    .filter(Boolean);

  // Artis unik (+ negara) dari chart, lalu status pernah-tampil.
  const artistMeta = new Map<string, string | undefined>();
  for (const r of artis) {
    const a = String(r.artis ?? "").trim();
    if (a && !artistMeta.has(a)) artistMeta.set(a, r.negara_asal);
  }
  const distinct = [...artistMeta.keys()].sort();
  // "Pernah tampil" = terverifikasi sumber publik ATAU muncul di korpus event SDI.
  // Korpus lengkap (semua tahun) — kehadiran artis tidak ikut filter tahun.
  const sdiSet = playedArtists(corpus, distinct);
  const played = (a: string) => appearanceFor(a) != null || sdiSet.has(a);

  // Pertunjukan yang memenuhi kriteria top global = nama event memuat artis dari daftar referensi.
  const topGlobalCount = seni.filter(
    (r) => playedArtists([String(r.nama_event ?? "")], distinct).size > 0
  ).length;
  const persenTopGlobal = seni.length > 0 ? (topGlobalCount / seni.length) * 100 : null;
  const artisSorted = [...distinct].sort((a, b) => {
    return (played(a) ? 0 : 1) - (played(b) ? 0 : 1) || a.localeCompare(b);
  });

  const years = Array.from(
    new Set(artis.map((r) => String(r.tahun ?? "")).filter(Boolean))
  ).sort();

  // Peta chart → tahun → peringkat → baris.
  const byChart = new Map<string, Map<string, Map<number, ArtisRow>>>();
  for (const r of artis) {
    const chart = String(r.chart ?? "");
    const year = String(r.tahun ?? "");
    const rank = Number(r.peringkat);
    if (!chart || !year || !Number.isFinite(rank)) continue;
    if (!byChart.has(chart)) byChart.set(chart, new Map());
    const yr = byChart.get(chart)!;
    if (!yr.has(year)) yr.set(year, new Map());
    yr.get(year)!.set(rank, r);
  }

  return (
    <PariwisataShell
      eyebrow="Cultural Experience · Seni Visual & Pertunjukan"
      title="Seni Visual & Pertunjukan"
      nilai={seni.length.toLocaleString("id-ID")}
      satuan="Pertunjukan"
      catatan="Berdasarkan data Dinas Pariwisata DKI Jakarta"
      sumber="Satu Data Jakarta, Calendar of Event"
      sumberHref="https://satudata.jakarta.go.id/open-data/data-seni-pertunjukan-dan-visual"
    >
      {/* ── DASHBOARD RINGKAS ── */}
      <section>
        <div className="mb-4 flex justify-end">
          <TahunFilter years={tahunOpsi} value={tahun} />
        </div>
        <KpiRow>
          <Kpi label="Jumlah pertunjukan" value={seni.length} sub={tahun || "semua tahun"} />
          <Kpi
            label="Memenuhi kriteria top global"
            value={topGlobalCount}
            sub="menampilkan artis Top 10 Global Chart"
          />
          <Kpi
            label="Persentase top global"
            value={
              persenTopGlobal == null
                ? "NA"
                : `${persenTopGlobal.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`
            }
            sub="top global / total pertunjukan"
          />
          <Kpi
            label="Skor Kearney (resmi)"
            value={!tahun || tahun === "2024" ? "156" : "NA"}
            sub="angka resmi Kearney 2024, bukan hitungan data SDI"
          />
          <Kpi label="Venue unik" value={venueUnik} />
          <Kpi
            label="Penyelenggaraan event"
            value={penyel.length ? eventTotal : "NA"}
            sub={tahun || "semua tahun"}
          />
        </KpiRow>
        <div className="mt-4">
          <ChartGrid>
            <ChartCard title="Penyelenggaraan event / bulan" sub={`semua event pariwisata & budaya · ${periodeEvent}`}>
              <LineTrend data={eventBulanan} unit="event" yName="Event" />
            </ChartCard>
            <ChartCard title="Top 10 venue tersibuk">
              <BarBreakdown data={topVenue} color={PALETTE[1]} />
            </ChartCard>
            <ChartCard title="Event per wilayah Jakarta" sub="klasifikasi alamat → wilayah (lengkap)">
              <Donut data={perWilayah} showPercent />
            </ChartCard>
          </ChartGrid>
        </div>
      </section>

      {/* ── PETA VENUE ── */}
      {(() => {
        // Filter tahun: sisakan event pada tahun terpilih, hitung ulang jumlah event per venue.
        const venues = (seniVenues as Venue[])
          .map((v) => {
            const events = v.events.filter((e) => inTahun(e.periode));
            return { ...v, events, eventCount: events.length };
          })
          .filter((v) => v.eventCount > 0);
        return (
          <Section title="Peta venue seni & pertunjukan">
            <VenueMapClient venues={venues} />
          </Section>
        );
      })()}

      {/* ── ARTIS TOP-10 GLOBAL + KEHADIRAN DI JAKARTA ── */}
      <Section title="Referensi Artis Top 10 Global Chart">
        {artis.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">
            Data artis chart belum tersedia.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tabel artis yang SUDAH pernah tampil di Jakarta (versi tabel dari
                status kehadiran) — hanya yang terbukti tampil, terurut tahun terakhir. */}
            {(() => {
              const playedList = artisSorted
                .filter((a) => played(a))
                .map((a) => ({ a, ap: appearanceFor(a) }))
                .sort((x, y) => {
                  const yx = x.ap ? Math.max(...x.ap.years) : 0;
                  const yy = y.ap ? Math.max(...y.ap.years) : 0;
                  if (yy !== yx) return yy - yx;
                  return x.a.localeCompare(y.a);
                });
              if (playedList.length === 0) return null;
              return (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
                      style={{ background: ACCENT }}
                    >
                      Artis yang sudah tampil di Jakarta
                    </span>
                    <span className="apple-fine text-ink-muted-48">
                      {playedList.length} artis · sumber: verifikasi publik dan data event Dispar
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-[13px]">
                        <thead>
                          <tr
                            style={{ background: ACCENT }}
                            className="text-left text-[11px] uppercase tracking-wider text-white"
                          >
                            <th className="px-3 py-2.5 font-semibold">Artis</th>
                            <th className="px-3 py-2.5 font-semibold">Negara</th>
                            <th className="px-3 py-2.5 font-semibold">Tahun tampil</th>
                            <th className="px-3 py-2.5 font-semibold">Venue</th>
                            <th className="px-3 py-2.5 font-semibold">Sumber</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playedList.map(({ a, ap }) => (
                            <tr key={a} className="border-t border-slate-100">
                              <td className="px-3 py-2 font-medium text-ink">{a}</td>
                              <td className="px-3 py-2 text-slate-600">
                                {artistMeta.get(a) ?? "—"}
                              </td>
                              <td className="px-3 py-2 tabular-nums text-slate-700">
                                {ap ? ap.years.join(", ") : "—"}
                              </td>
                              <td className="px-3 py-2 text-slate-700">{ap?.venue ?? "—"}</td>
                              <td className="px-3 py-2">
                                {ap ? (
                                  <a
                                    href={ap.source}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-medium hover:underline"
                                    style={{ color: "#2563eb" }}
                                  >
                                    Verifikasi ↗
                                  </a>
                                ) : (
                                  <span
                                    className="text-slate-400"
                                    title="Tercatat pada data event Dispar; belum diverifikasi dengan sumber publik lain"
                                  >
                                    Data event Dispar
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Matriks peringkat × tahun */}
            {CHARTS.filter((c) => byChart.has(c.key)).map((c) => {
              const yr = byChart.get(c.key)!;
              return (
                <div key={c.key}>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
                      style={{ background: ACCENT }}
                    >
                      {c.label}
                    </span>
                    <span className="apple-fine text-ink-muted-48">peringkat 1–10 · {years.join(", ")}</span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-[13px]">
                        <thead>
                          <tr
                            style={{ background: ACCENT }}
                            className="text-left text-[11px] uppercase tracking-wider text-white"
                          >
                            <th className="w-14 px-3 py-2.5 font-semibold">#</th>
                            {years.map((y) => (
                              <th key={y} className="px-3 py-2.5 font-semibold">
                                {y}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((rank) => (
                            <tr key={rank} className="border-t border-slate-100">
                              <td className="px-3 py-2 tabular-nums font-semibold text-ink-muted-48">
                                {rank}
                              </td>
                              {years.map((y) => {
                                const row = yr.get(y)?.get(rank);
                                const cellPlayed = row ? played(String(row.artis)) : false;
                                return (
                                  <td key={y} className="px-3 py-2 text-slate-700">
                                    {row ? (
                                      <span title={row.negara_asal ?? undefined}>
                                        {row.artis}
                                        {cellPlayed && (
                                          <span
                                            className="ml-1 font-bold text-green-600"
                                            title="Pernah tampil di Jakarta (data Dispar)"
                                          >
                                            ✓
                                          </span>
                                        )}
                                        {row.negara_asal && (
                                          <span className="ml-1 text-[11px] text-ink-muted-48">
                                            · {row.negara_asal}
                                          </span>
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── DATA MENTAH & SUMBER (paling bawah) ── */}
      <Section
        title="Sumber"
        desc="Data pendukung Dinas Pariwisata & Ekraf — event pertunjukan & seni visual di Jakarta."
      >
        <RawDataDisclosure
          slug="data-seni-pertunjukan-dan-visual"
          title="Seni Visual & Pertunjukan"
          count={seniAll.length}
          label="Lihat data SDI"
          columns={["nama_event", "nama_venue", "lokasi_venue", "periode_data"]}
        />
        <div className="mt-5 rounded-xl border border-hairline bg-white/60 p-4">
          <div className="apple-fine uppercase tracking-wider text-ink-muted-48">
            Data pendukung lain (katalog SDI)
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
            {PENDUKUNG.map((d) => (
              <Link
                key={d.slug}
                href={`/sdi/${d.slug}`}
                className="hover:underline"
                style={{ color: "#2563eb" }}
              >
                {d.label} ↗
              </Link>
            ))}
          </div>
        </div>
      </Section>
    </PariwisataShell>
  );
}
