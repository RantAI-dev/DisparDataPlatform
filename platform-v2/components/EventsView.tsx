"use client";

import { useEffect, useMemo, useState } from "react";

import { AtlasNav, LangToggle } from "@/components/atlas/AtlasNav";
import { ExportButton } from "@/components/atlas/ExportButton";
import {
  GCI_EVENTS,
  EVENT_CATEGORIES,
  eventStats,
  eventNeedsVerify,
  type GciEvent,
} from "@/lib/events";
import {
  type CsvColumn,
  type ExportFormat,
  dateStamp,
  downloadSpreadsheet,
} from "@/lib/export";
import {
  DEFAULT_LANG,
  STORAGE_KEY,
  translate,
  type Lang,
} from "@/lib/i18n";

const CAT_FILTERS = ["Semua", ...EVENT_CATEGORIES] as const;
type CatFilter = (typeof CAT_FILTERS)[number];

const YEAR_FILTERS = ["Semua", "2025", "2026"] as const;
type YearFilter = (typeof YEAR_FILTERS)[number];

/** Tahun penyelenggaraan dari string tanggal (ambil tahun pertama yang muncul). */
function eventYear(e: GciEvent): string {
  const m = e.date.match(/(20\d{2})/);
  return m ? m[1] : "";
}

const PAGE = 200;

export function EventsView() {
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);
  const [cat, setCat] = useState<CatFilter>("Semua");
  const [year, setYear] = useState<YearFilter>("Semua");
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(PAGE);

  const t = (key: string) => translate(lang, key);

  function onToggleLang() {
    const next: Lang = lang === "id" ? "en" : "id";
    setLang(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  const stats = useMemo(
    () => eventStats(year === "Semua" ? undefined : year),
    [year]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return GCI_EVENTS.filter((e) => {
      if (year !== "Semua" && eventYear(e) !== year) return false;
      if (cat !== "Semua" && e.category !== cat) return false;
      if (
        needle &&
        !`${e.name} ${e.organizer} ${e.venue} ${e.type} ${e.date} ${e.note}`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [cat, year, q]);

  useEffect(() => {
    setVisible(PAGE);
  }, [cat, year, q]);

  const paged = filtered.slice(0, visible);

  async function exportEvents(format: ExportFormat) {
    if (filtered.length === 0) {
      alert("Tidak ada data untuk diekspor — coba longgarkan filter.");
      return;
    }
    // 6 kolom inti SESUAI template Disparekraf (bilingual), lalu kolom bantu.
    const columns: CsvColumn<GciEvent>[] = [
      { header: "No.", value: (_e, i) => i + 1 },
      { header: "Nama Penyelenggara - Organizer", value: (e) => e.organizer },
      { header: "Nama Pertunjukan - Name of Performance", value: (e) => e.name },
      { header: "Tanggal Pertunjukan - Date of Performance", value: (e) => e.date },
      { header: "Tempat Pertunjukan - Place of Performance", value: (e) => e.venue },
      { header: "Jenis Pertunjukan - Type of Performance", value: (e) => e.type },
      { header: "Jumlah Pengunjung - Number of Visitor", value: (e) => e.visitors },
      { header: "Keterangan - Notes", value: (e) => e.note },
      // ── kolom bantu (boleh dihapus sebelum submit) ──
      { header: "Sumber", value: (e) => e.source },
    ];
    const yearTag = year === "Semua" ? "2025-2026" : year;
    await downloadSpreadsheet(
      `data-pertunjukan-GCI-jakarta-${yearTag}-${dateStamp()}`,
      filtered,
      columns,
      format,
      `Pertunjukan GCI ${yearTag}`
    );
  }

  return (
    <main data-section="gci" className="min-h-screen flex flex-col bg-paper">
      <AtlasNav
        langToggle={<LangToggle lang={lang} onToggle={onToggleLang} t={t} />}
      />

      {/* HERO */}
      <section className="border-b border-hairline bg-paper">
        <div className="mx-auto max-w-[1320px] px-6 py-10 md:py-14">
          <div className="flex items-center gap-3">
            <span className="atlas-mono text-ink-muted-48">
              GLOBAL CITY INDEX · DISPAREKRAF DKI
            </span>
            <span className="flex-1 border-t border-hairline" />
            <span className="atlas-coord">TAHUN 2025–2026</span>
          </div>
          <div className="mt-6 grid md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-7">
              <h1 className="atlas-display text-ink">
                Pertunjukan &amp;{" "}
                <span className="atlas-italic text-[color:var(--accent)]">
                  Budaya
                </span>
              </h1>
              <p className="apple-body mt-4 text-ink-muted-80 max-w-[62ch]">
                Inventarisasi pertunjukan musik internasional &amp; nasional
                serta acara budaya besar di Jakarta sepanjang 2025–2026 — konser,
                festival, seni tari, teater, orkestra, seni rupa, dan film —
                untuk Global City Index.
              </p>
            </div>
            <dl className="md:col-span-5 grid grid-cols-4 gap-x-4 gap-y-1 md:border-l md:border-hairline md:pl-6">
              <StatTile label="TOTAL" value={String(stats.total)} />
              <StatTile label="KONSER" value={String(stats.konser)} />
              <StatTile label="FESTIVAL" value={String(stats.festival)} />
              <StatTile label="BUDAYA" value={String(stats.budaya)} />
            </dl>
          </div>
        </div>
      </section>

      {/* FILTER STRIP */}
      <section className="frosted border-b border-hairline sticky top-[56px] z-20">
        <div className="mx-auto max-w-[1320px] px-6 py-3 flex flex-wrap items-center gap-3">
          <span className="atlas-mono text-ink-muted-48">FILTER ·</span>

          <div className="inline-flex p-1 bg-canvas border border-hairline rounded-full">
            {YEAR_FILTERS.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`press-scale rounded-full px-3 py-1 apple-caption whitespace-nowrap ${
                  year === y
                    ? "bg-[color:var(--accent)] text-white"
                    : "text-ink-muted-80 hover:text-ink"
                }`}
              >
                {y === "Semua" ? "Semua tahun" : y}
              </button>
            ))}
          </div>

          <div className="inline-flex p-1 bg-canvas border border-hairline rounded-full flex-wrap">
            {CAT_FILTERS.map((k) => (
              <button
                key={k}
                onClick={() => setCat(k)}
                className={`press-scale rounded-full px-3 py-1 apple-caption whitespace-nowrap ${
                  cat === k
                    ? "bg-[color:var(--accent)] text-white"
                    : "text-ink-muted-80 hover:text-ink"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama / penyelenggara / tempat…"
            className="bg-canvas border border-hairline rounded-full h-9 px-4 apple-caption text-ink placeholder:text-ink-muted-48 focus:outline-none focus:border-[color:var(--accent)] min-w-[220px]"
          />

          <span className="ml-auto atlas-mono text-ink-muted-48">
            {filtered.length}/{GCI_EVENTS.length} entri
          </span>
          <ExportButton
            onExport={exportEvents}
            label={`Ekspor Excel (${filtered.length})`}
          />
        </div>
      </section>

      {/* TABEL */}
      <section className="flex-1">
        <div className="mx-auto max-w-[1320px] px-6 py-6">
          <div className="overflow-x-auto border border-hairline rounded-lg bg-canvas">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline bg-paper">
                  <Th className="w-12 text-right pr-3">No.</Th>
                  <Th>Nama Pertunjukan</Th>
                  <Th>Penyelenggara</Th>
                  <Th>Tanggal</Th>
                  <Th>Tempat</Th>
                  <Th>Jenis</Th>
                  <Th className="text-right">Jumlah Pengunjung</Th>
                  <Th>Keterangan</Th>
                </tr>
              </thead>
              <tbody>
                {paged.map((e, i) => (
                  <tr
                    key={e.id}
                    className="border-b border-hairline last:border-0 hover:bg-paper transition-colors"
                  >
                    <td className="px-3 py-3 text-right atlas-mono text-ink-muted-48 tabular align-top">
                      {i + 1}
                    </td>
                    <td className="px-3 py-3 align-top max-w-[320px]">
                      {e.source ? (
                        <a
                          href={e.source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="apple-body-strong text-ink hover:text-[color:var(--accent)]"
                        >
                          {e.name}
                        </a>
                      ) : (
                        <span className="apple-body-strong text-ink">
                          {e.name}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top apple-caption text-ink-muted-80 max-w-[220px]">
                      {e.organizer || "—"}
                    </td>
                    <td className="px-3 py-3 align-top apple-caption text-ink-muted-80 whitespace-nowrap">
                      {e.date}
                    </td>
                    <td className="px-3 py-3 align-top apple-caption text-ink-muted-80 max-w-[240px]">
                      {e.venue}
                    </td>
                    <td className="px-3 py-3 align-top apple-caption text-ink-muted-80 max-w-[200px]">
                      {e.type}
                    </td>
                    <td className="px-3 py-3 align-top text-right atlas-mono tabular text-ink-muted-80 whitespace-nowrap">
                      {e.visitors ? (
                        <>
                          {e.visitors}
                          {eventNeedsVerify(e) && (
                            <span
                              title="Angka belum diverifikasi"
                              className="text-[color:var(--accent)]"
                            >
                              {" "}*
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3 align-top apple-fine text-ink-muted-48 max-w-[200px]">
                      {e.note || "—"}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-12 text-center apple-caption text-ink-muted-48"
                    >
                      Tidak ada entri yang cocok dengan filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > visible && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => setVisible((v) => v + PAGE)}
                className="press-scale rounded-full border border-hairline bg-canvas px-5 py-2 apple-caption-strong text-ink hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] transition-colors"
              >
                Muat {Math.min(PAGE, filtered.length - visible)} lagi
              </button>
            </div>
          )}

          <p className="apple-caption text-ink-muted-48 mt-3 text-center">
            Menampilkan {paged.length} dari {filtered.length} entri terfilter.
            Angka bertanda <span className="text-[color:var(--accent)]">*</span>{" "}
            adalah kapasitas, perkiraan, atau target dan belum diverifikasi.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-hairline bg-paper">
        <div className="mx-auto max-w-[1320px] px-6 py-5 atlas-fine text-ink-muted-48 flex flex-wrap items-center justify-between gap-2">
          <span>
            Sumber: berita, platform tiket, situs penyelenggara (link per baris).
            GCI — Disparekraf DKI Jakarta.
          </span>
          <span>{translate(lang, "footer.typeface")}</span>
        </div>
      </footer>
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="atlas-mono text-ink-muted-48">{label}</dt>
      <dd className="atlas-display-md text-ink tabular mt-1">{value}</dd>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2.5 atlas-mono text-ink-muted-48 font-medium whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}
