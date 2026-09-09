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

export default async function SeniPertunjukanPage() {
  const safe = async (s: string) => {
    try {
      return (await rowsFor(s)) as Record<string, unknown>[];
    } catch {
      return [];
    }
  };

  const [artisRaw, seni, pen, ev1119, rekom, penyel] = await Promise.all([
    safe("artis-top-global-chart"),
    safe("data-seni-pertunjukan-dan-visual"),
    safe(PENDUKUNG[0].slug),
    safe(PENDUKUNG[1].slug),
    safe(PENDUKUNG[2].slug),
    safe("jumlah-penyelenggaraan-event"),
  ]);
  const artis = artisRaw as ArtisRow[];

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
  const topVenue = topN(groupCount(seni, "nama_venue"), 10);
  const perWilayah = groupCount(
    seni.map((r) => ({ wil: wilayahFromAddress(r.lokasi_venue) })),
    "wil"
  ).sort((a, b) => b.value - a.value);
  const venueUnik = new Set(seni.map((r) => r.nama_venue).filter(Boolean)).size;

  // ── Korpus nama-event Jakarta (2010–2025) untuk cek kehadiran artis ──
  const corpus: string[] = [
    ...seni.map((r) => r.nama_event),
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
  const sdiSet = playedArtists(corpus, distinct);
  const played = (a: string) => appearanceFor(a) != null || sdiSet.has(a);
  const playedCount = distinct.filter(played).length;
  const sdiCount = distinct.filter((a) => sdiSet.has(a)).length;
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
      satuan="Event internasional"
      tahun="2025"
      pj="Dinas Pariwisata & Ekraf"
      catatan={`Berdasarkan data Dispar (SDI) 2025: ${seni.length} event seni & pertunjukan internasional di Jakarta. Skor indikator resmi Kearney 2024 = 156 (lihat KPI). Belum digabung dengan data Dinas Kebudayaan (Disbud).`}
      sumber="satudata.jakarta.go.id"
      sumberHref="https://satudata.jakarta.go.id/open-data/data-seni-pertunjukan-dan-visual"
    >
      {/* ── DASHBOARD RINGKAS ── */}
      <section>
        <KpiRow>
          <Kpi label="Event internasional 2025" value={seni.length} sub="data Dispar · SDI" />
          <Kpi label="Skor Kearney (resmi)" value="156" sub="2024 · competitiveness" />
          <Kpi label="Venue unik" value={venueUnik} />
          <Kpi
            label="Penyelenggaraan event 2024"
            value={eventPerTahun.find((e) => e.label === "2024")?.value ?? 0}
            sub={`2025: ${(eventPerTahun.find((e) => e.label === "2025")?.value ?? 0).toLocaleString("id-ID")}`}
          />
        </KpiRow>
        <div className="mt-4">
          <ChartGrid>
            <ChartCard title="Penyelenggaraan event / bulan" sub="semua event pariwisata & budaya · 2024–2025">
              <LineTrend data={eventBulanan} unit="event" yName="Event" />
            </ChartCard>
            <ChartCard title="Top 10 venue tersibuk">
              <BarBreakdown data={topVenue} color={PALETTE[1]} />
            </ChartCard>
            <ChartCard title="Event per wilayah Jakarta" sub="klasifikasi alamat → wilayah (lengkap)">
              <Donut data={perWilayah} />
            </ChartCard>
          </ChartGrid>
        </div>
      </section>

      {/* ── PETA VENUE ── */}
      {(() => {
        const venues = seniVenues as Venue[];
        const goldCount = venues.filter((v) => v.gold).length;
        return (
          <Section
            title="Peta venue seni & pertunjukan"
            desc={
              <>
                {venues.length} venue tergeokode dari data event 2025 (radius ∝ jumlah event).
                Titik <b style={{ color: "#b8860b" }}>emas</b> = {goldCount} venue yang pernah
                menghadirkan artis <b>Top-10 Global Chart</b> terverifikasi (JIS, GBK). Klik titik
                untuk info venue + daftar event.
              </>
            }
          >
            <VenueMapClient venues={venues} />
          </Section>
        );
      })()}

      {/* ── ARTIS TOP-10 GLOBAL + KEHADIRAN DI JAKARTA ── */}
      <Section
        title="Artis Top 10 Global Chart — apakah Jakarta sudah menghadirkannya?"
        desc={
          <>
            <b>Catatan metodologi:</b> metrik resmi Kearney untuk faktor ini adalah{" "}
            <b>jumlah venue seni pertunjukan</b> (snapshot tahunan; dimensi Cultural Experience
            berbobot 15%) — <b>bukan</b> jendela "N tahun terakhir". Kriteria{" "}
            <b>artis Top-10 Global Chart 5 tahun terakhir (2021–2025)</b> di bawah adalah{" "}
            <b>operasionalisasi internal Jakarta</b> (MoM 13 Juli) sebagai proxy kualitas
            "world-class", bukan aturan Kearney. Referensi:{" "}
            <a href="https://www.kearney.com/service/national-transformations-institute/gcr" target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "#2563eb" }}>
              Kearney GCR ↗
            </a>{" "}
            ·{" "}
            <Link href="/sdi/artis-top-global-chart" className="hover:underline" style={{ color: "#2563eb" }}>
              artis-top-global-chart ↗
            </Link>
            .
          </>
        }
      >
        {artis.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">
            Data artis chart belum tersedia.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Banner gap kriteria Kearney */}
            <div className="utility-card border-l-4 p-5" style={{ borderLeftColor: ACCENT }}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[40px] font-bold leading-none tabular text-ink">
                  {playedCount}
                  <span className="text-ink-muted-48">/{distinct.length}</span>
                </span>
                <span className="apple-lead text-ink">
                  artis Top-10 global (2021–2025) tercatat pernah tampil di Jakarta
                </span>
              </div>
              <p className="mt-2 apple-caption text-ink-muted-48 max-w-[92ch]">
                Status = terverifikasi sumber publik <b>atau</b> muncul di korpus{" "}
                {corpus.length.toLocaleString("id-ID")} nama event Dispar (SDI, 2010–2025). Catatan
                penting: <b>{sdiCount} dari {distinct.length}</b> artis muncul di data SDI Dispar —
                konser besar (mis. Ed Sheeran, Bruno Mars) yang <i>benar-benar</i> digelar di
                Jakarta <b>tidak tercatat</b> di dataset Dispar. Itulah gap pencatatan yang menekan
                skor Kearney. "Belum terdata" = belum ada bukti di kedua sumber.
              </p>
            </div>

            {/* Status kehadiran tiap artis */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
                  style={{ background: ACCENT }}
                >
                  Status kehadiran di Jakarta
                </span>
                <span className="apple-fine text-ink-muted-48">{distinct.length} artis unik</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {artisSorted.map((a) => {
                  const ap = appearanceFor(a);
                  const isPlayed = played(a);
                  const lastYear = ap ? Math.max(...ap.years) : null;
                  return (
                    <div
                      key={a}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-[13px] ${
                        isPlayed ? "border-green-200 bg-green-50" : "border-hairline bg-white"
                      }`}
                    >
                      <span className="truncate text-ink" title={ap ? `${a} — ${ap.venue ?? ""} (${ap.years.join(", ")})` : a}>
                        {ap ? (
                          <a href={ap.source} target="_blank" rel="noreferrer" className="hover:underline">
                            {a}
                          </a>
                        ) : (
                          a
                        )}
                        {artistMeta.get(a) && (
                          <span className="ml-1 text-[11px] text-ink-muted-48">· {artistMeta.get(a)}</span>
                        )}
                      </span>
                      <span
                        className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          isPlayed ? "bg-green-600 text-white" : "bg-slate-100 text-slate-400"
                        }`}
                        title={ap ? `Terverifikasi: ${ap.years.join(", ")}` : undefined}
                      >
                        {isPlayed ? (lastYear ? `✓ ${lastYear}` : "✓ Terdata") : "Belum terdata"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

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
                      {playedList.length} artis · sumber: verifikasi publik / korpus event Dispar
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
                                    title="Muncul di korpus nama event Dispar (SDI), belum diverifikasi sumber publik terpisah"
                                  >
                                    Korpus event Dispar
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
        title="Data mentah & sumber"
        desc="Data pendukung Dinas Pariwisata & Ekraf — event pertunjukan & seni visual di Jakarta."
      >
        <RawDataDisclosure
          slug="data-seni-pertunjukan-dan-visual"
          title="Seni Visual & Pertunjukan"
          count={seni.length}
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
