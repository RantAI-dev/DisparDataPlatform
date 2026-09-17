"use client";

/**
 * ATLAS — GMTI (Jakarta Ramah Muslim), tampilan DAFTAR.
 *
 * Menyatukan tujuh sumber jadi satu halaman berpilar: fasilitas ibadah SIMAS
 * Kemenag + enam dataset halal Dispar. Pola tampilan mengikuti Direktori
 * Restoran/Suvenir: AtlasNav toggle Daftar|Peta → hero → stats tile →
 * toolbar sticky → daftar (kartu/tabel) dengan paginasi.
 *
 * Kenapa data ibadah di-fetch, bukan di-import: daftarnya 8.331 baris (~2 MB).
 * Kalau di-import seperti dataset Atlas lain, seluruhnya ikut ke bundle JS dan
 * halaman jadi berat dibuka. Agregat & tempat ber-koordinat tetap di-import
 * (kecil) supaya hero, angka, dan peta langsung tampil tanpa menunggu.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { AtlasNav } from "@/components/atlas/AtlasNav";
import { ExportButton } from "@/components/atlas/ExportButton";
import {
  GMTI_AGG,
  GMTI_CAPAIAN,
  GMTI_META,
  GMTI_PLACES,
  GMTI_TIPOLOGI,
} from "@/lib/gmti-data";
import {
  IBADAH_URL,
  PILLARS,
  PILLAR_COLOR,
  PILLAR_DESC,
  PILLAR_LABEL,
  gmtiMapsUrl,
  idNum,
  isNonSignature,
  snapshotDate,
  type GmtiPlace,
  type IbadahFile,
  type Pillar,
} from "@/lib/gmti";
import {
  type CsvColumn,
  type ExportFormat,
  dateStamp,
  downloadSpreadsheet,
} from "@/lib/export";

/** AtlasNav memakai key i18n; section ini berbahasa Indonesia tanpa dictionary. */
export const navLabel = (k: string): string =>
  k === "nav.view_list" ? "Daftar" : k === "nav.view_map" ? "Peta" : k;

const PAGE = 200;

type TabId = Pillar | "semua";
const TABS: TabId[] = ["semua", ...PILLARS];
const tabLabel = (t: TabId) => (t === "semua" ? "Semua" : PILLAR_LABEL[t]);

/** Butuh daftar ibadah yang besar? Hanya dua tab ini. */
const needsIbadah = (t: TabId) => t === "ibadah" || t === "semua";

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="apple-hero apple-title-tight text-ink tabular">{number}</div>
      <div className="apple-caption text-ink-muted-80 mt-1.5">{label}</div>
    </div>
  );
}

function MiniSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none press-scale bg-canvas border border-hairline rounded-full h-9 pl-4 pr-9 apple-caption text-ink-muted-80 hover:text-ink focus:outline-none focus:border-primary-focus transition-colors cursor-pointer max-w-[240px] truncate"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-ink-muted-48 pointer-events-none"
        aria-hidden
      >
        <path fill="currentColor" d="M7 10l5 5 5-5z" />
      </svg>
    </div>
  );
}

function PillarBadge({ p }: { p: Pillar }) {
  return (
    <span
      className="shrink-0 apple-fine uppercase tracking-wider px-1.5 py-0.5 rounded"
      style={{ background: `${PILLAR_COLOR[p]}1a`, color: PILLAR_COLOR[p] }}
    >
      {PILLAR_LABEL[p]}
    </span>
  );
}

function Card({ p }: { p: GmtiPlace }) {
  const noCoord = p.lat == null || p.lon == null;
  return (
    <li className="utility-card bg-canvas border border-hairline rounded-apple_lg p-6 flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <p className="apple-caption-strong text-primary tracking-[0.06em] text-[11px] uppercase truncate">
          {p.kind}
        </p>
        <PillarBadge p={p.pillar} />
      </div>

      <h3 className="apple-tagline apple-title-tight text-ink mt-1.5 leading-[1.15]">
        {p.name}
      </h3>

      <p className="apple-caption text-ink-muted-48 mt-1">
        {[p.district, p.city].filter(Boolean).join(" · ") || "—"}
      </p>

      {p.address && (
        <p className="apple-caption text-ink-muted-80 mt-3 line-clamp-2">{p.address}</p>
      )}

      {p.note && (
        <p className="apple-caption text-ink-muted-80 mt-3 line-clamp-3">{p.note}</p>
      )}

      {p.cert && (
        <p className="apple-fine text-ink-muted-48 mt-3">
          Sertifikat halal: <span className="tabular">{p.cert}</span>
        </p>
      )}

      {noCoord && (
        <p className="apple-fine text-ink-muted-48 mt-3 italic">
          Titik peta belum diverifikasi — tidak ditampilkan di peta.
        </p>
      )}

      <div className="mt-auto pt-5 flex items-center justify-between gap-4">
        <a
          href={gmtiMapsUrl(p)}
          target="_blank"
          rel="noopener noreferrer"
          className="press-scale link-blue apple-caption-strong inline-flex items-center gap-1"
        >
          {noCoord ? "Cari di Maps" : "Buka di Maps"}
          <span aria-hidden>↗</span>
        </a>
        <span className="apple-fine text-ink-muted-48 truncate">{p.dataset}</span>
      </div>
    </li>
  );
}

export function GmtiView() {
  const [tab, setTab] = useState<TabId>("semua");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("All");
  const [kind, setKind] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [limit, setLimit] = useState(PAGE);

  const [ibadah, setIbadah] = useState<GmtiPlace[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** Ambil daftar ibadah sekali saja, saat tab yang membutuhkannya dibuka. */
  const loadIbadah = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(IBADAH_URL, { cache: "force-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const file = (await res.json()) as IbadahFile;
      setIbadah(
        file.rows.map((r) => ({
          id: `simas-${r.id}`,
          name: r.name,
          pillar: "ibadah" as const,
          kind: r.tipologi,
          dataset: "SIMAS Kemenag",
          address: r.address,
          city: r.kota,
          district: r.kecamatan,
          lat: r.lat,
          lon: r.lon,
        }))
      );
    } catch (err) {
      setLoadError(
        `Gagal memuat daftar fasilitas ibadah (${String(err)}). Muat ulang halaman untuk mencoba lagi.`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (needsIbadah(tab) && ibadah === null && !loading && !loadError) {
      void loadIbadah();
    }
  }, [tab, ibadah, loading, loadError, loadIbadah]);

  /** Reset paginasi tiap kali filter berubah. */
  useEffect(() => setLimit(PAGE), [tab, query, city, kind]);

  const halal = useMemo(() => GMTI_PLACES.filter((p) => p.pillar !== "ibadah"), []);

  const pool = useMemo(() => {
    if (tab === "semua") return [...(ibadah ?? []), ...halal];
    if (tab === "ibadah") return ibadah ?? [];
    return halal.filter((p) => p.pillar === tab);
  }, [tab, ibadah, halal]);

  const cityOptions = useMemo(() => {
    const set = new Set(pool.map((p) => p.city).filter((c): c is string => !!c));
    return ["All", ...[...set].sort((a, b) => a.localeCompare(b, "id"))];
  }, [pool]);

  const kindOptions = useMemo(() => {
    const set = new Set(pool.map((p) => p.kind).filter(Boolean));
    return ["All", ...[...set].sort((a, b) => a.localeCompare(b, "id"))];
  }, [pool]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((p) => {
      if (city !== "All" && p.city !== city) return false;
      if (kind !== "All" && p.kind !== kind) return false;
      if (!q) return true;
      return [p.name, p.kind, p.address, p.city, p.district, p.cert]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [pool, query, city, kind]);

  const shown = filtered.slice(0, limit);

  async function exportGmti(format: ExportFormat) {
    const columns: CsvColumn<GmtiPlace>[] = [
      { header: "No", value: (_p, i) => i + 1 },
      { header: "Nama", value: (p) => p.name },
      { header: "Pilar", value: (p) => PILLAR_LABEL[p.pillar] },
      { header: "Jenis/Tipologi", value: (p) => p.kind },
      { header: "Sumber Dataset", value: (p) => p.dataset },
      { header: "Alamat", value: (p) => p.address ?? "" },
      { header: "Kota Administrasi", value: (p) => p.city ?? "" },
      { header: "Kecamatan", value: (p) => p.district ?? "" },
      { header: "Lintang", value: (p) => p.lat ?? "" },
      { header: "Bujur", value: (p) => p.lon ?? "" },
      { header: "No Sertifikat Halal", value: (p) => p.cert ?? "" },
      { header: "Catatan", value: (p) => p.note ?? "" },
    ];
    await downloadSpreadsheet(
      `jakarta-atlas-gmti-${tab}-${dateStamp()}`,
      filtered,
      columns,
      format,
      "GMTI"
    );
  }

  const topKecamatan = useMemo(() => GMTI_AGG.slice(0, 6), []);
  const gmtiAward = useMemo(
    () => GMTI_CAPAIAN.find((c) => /GMTI/i.test(c.nama)) ?? GMTI_CAPAIAN[0],
    []
  );

  return (
    <main className="min-h-screen bg-canvas">
      <AtlasNav section="gmti" view="list" t={navLabel} />

      {/* ── HERO ── */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-[1280px] px-6 py-[80px] md:py-[120px] text-center">
          <p className="apple-caption-strong text-ink-muted-80">
            Data sekunder · Wisata ramah muslim (GMTI)
          </p>
          <h1 className="apple-hero apple-title-tight mt-3 text-ink">
            Jakarta ramah muslim,
            <br />
            <span className="text-ink-muted-48">satu peta besar.</span>
          </h1>
          <p className="apple-lead mt-6 max-w-[820px] mx-auto">
            <span className="text-ink">{idNum(GMTI_META.ibadahTotal)} masjid & mushalla</span>{" "}
            terdaftar SIMAS Kemenag se-DKI, digabung dengan{" "}
            <span className="text-ink">{idNum(GMTI_META.halalTotal)} tempat</span> dari
            enam dataset halal Dispar — restoran bersertifikat, hotel, mall, RPH,
            warisan Islam, sampai program ramah muslim.
          </p>
          {gmtiAward && (
            <p className="apple-caption text-ink-muted-80 mt-6 max-w-[720px] mx-auto">
              {gmtiAward.nama}
              {gmtiAward.pemberi ? ` — ${gmtiAward.pemberi}` : ""}
            </p>
          )}
          <div className="mt-9 flex items-center justify-center gap-4">
            <a href="#directory" className="press-scale pill-primary">
              Lihat daftar
            </a>
            <a href="/gmti/map" className="press-scale pill-secondary">
              Buka peta
            </a>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-parchment border-y border-hairline">
        <div className="mx-auto max-w-[1280px] px-6 py-[64px] md:py-[80px] grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6 text-center">
          <Stat number={idNum(GMTI_META.masjid)} label="Masjid terdaftar" />
          <Stat number={idNum(GMTI_META.mushalla)} label="Mushalla terdaftar" />
          <Stat number={idNum(GMTI_META.halalTotal)} label="Tempat ekosistem halal" />
          <Stat number={idNum(GMTI_META.kecamatan)} label="Kecamatan terliput" />
        </div>
      </section>

      {/* ── SEBARAN RINGKAS ── */}
      <section className="mx-auto max-w-[1280px] px-6 pt-14">
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="apple-tagline apple-title-tight text-ink">
              Kecamatan terpadat fasilitas ibadah
            </h2>
            <ul className="mt-4 space-y-2.5">
              {topKecamatan.map((a) => (
                <li key={`${a.kota}-${a.kecamatan}`} className="flex items-center gap-3">
                  <span className="apple-caption text-ink w-[150px] shrink-0 truncate">
                    {a.kecamatan}
                  </span>
                  <span className="flex-1 h-2 bg-parchment rounded-full overflow-hidden">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${(a.total / topKecamatan[0].total) * 100}%`,
                        background: PILLAR_COLOR.ibadah,
                      }}
                    />
                  </span>
                  <span className="apple-caption tabular text-ink-muted-80 w-[52px] text-right">
                    {idNum(a.total)}
                  </span>
                </li>
              ))}
            </ul>
            <a href="/gmti/map" className="press-scale link-blue apple-caption mt-4 inline-block">
              Lihat sebaran seluruh {GMTI_META.kecamatan} kecamatan di peta ↗
            </a>
          </div>

          <div>
            <h2 className="apple-tagline apple-title-tight text-ink">Menurut tipologi</h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5">
              {GMTI_TIPOLOGI.map((t) => (
                <li key={t.tipologi} className="flex items-baseline justify-between gap-3">
                  <span className="apple-caption text-ink-muted-80 truncate">
                    {t.tipologi}
                  </span>
                  <span className="apple-caption-strong tabular text-ink">
                    {idNum(t.count)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── TOOLBAR ── */}
      <section id="filters" className="sticky top-[56px] z-10 frosted mt-12">
        <div className="mx-auto max-w-[1280px] px-6 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <svg
                viewBox="0 0 24 24"
                className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted-48"
                aria-hidden
              >
                <path
                  fill="currentColor"
                  d="M10 18a8 8 0 1 1 5.293-1.707l4.207 4.207-1.414 1.414-4.207-4.207A7.96 7.96 0 0 1 10 18zm0-2a6 6 0 1 0 0-12 6 6 0 0 0 0 12z"
                />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama, alamat, kecamatan, atau nomor sertifikat…"
                className="w-full bg-canvas border border-hairline rounded-lg pl-11 pr-20 h-10 text-[14px] placeholder:text-ink-muted-48 focus:outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-ring)] transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 apple-caption tabular text-ink-muted-48">
                {idNum(filtered.length)}
              </span>
            </div>
            <div className="inline-flex p-0.5 bg-canvas border border-hairline rounded-full">
              {(["grid", "table"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`press-scale rounded-full px-3 py-1 apple-caption-strong ${
                    viewMode === m ? "bg-ink text-white" : "text-ink-muted-80 hover:text-ink"
                  }`}
                >
                  {m === "grid" ? "Kartu" : "Tabel"}
                </button>
              ))}
            </div>
            <ExportButton onExport={exportGmti} label="Unduh" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-1 bg-canvas border border-hairline rounded-full flex-wrap">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                    setCity("All");
                    setKind("All");
                  }}
                  className={`press-scale rounded-full px-3 py-1 apple-caption ${
                    tab === t ? "bg-primary text-white" : "text-ink-muted-80 hover:text-ink"
                  }`}
                >
                  {tabLabel(t)}
                </button>
              ))}
            </div>
            <span className="hidden md:inline-block h-5 w-px bg-hairline mx-1" />
            <MiniSelect
              value={city}
              onChange={setCity}
              options={cityOptions.map((c) => ({
                id: c,
                label: c === "All" ? "Semua wilayah" : c,
              }))}
            />
            <MiniSelect
              value={kind}
              onChange={setKind}
              options={kindOptions.map((k) => ({
                id: k,
                label: k === "All" ? "Semua jenis" : k,
              }))}
            />
          </div>
        </div>
      </section>

      {/* ── DAFTAR ── */}
      <section id="directory" className="mx-auto max-w-[1280px] px-6 py-12">
        {tab !== "semua" && (
          <p className="apple-caption text-ink-muted-80 mb-6">{PILLAR_DESC[tab]}</p>
        )}

        {loadError && (
          <div className="border border-hairline rounded-apple_lg bg-parchment p-6 mb-6">
            <p className="apple-caption text-ink">{loadError}</p>
          </div>
        )}

        {loading && needsIbadah(tab) && (
          <p className="apple-caption text-ink-muted-48 py-16 text-center">
            Memuat {idNum(GMTI_META.ibadahTotal)} fasilitas ibadah…
          </p>
        )}

        {!loading && filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="apple-tagline text-ink">Tidak ada yang cocok</p>
            <p className="apple-caption text-ink-muted-48 mt-2">
              Coba longgarkan filter atau kosongkan kolom pencarian.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {shown.map((p) => (
              <Card key={p.id} p={p} />
            ))}
          </ul>
        ) : (
          <div className="overflow-x-auto border border-hairline rounded-apple_lg bg-canvas">
            <table className="w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="border-b border-hairline bg-parchment">
                  {["Nama", "Jenis", "Wilayah", "Pilar", "Sumber"].map((h) => (
                    <th key={h} className="apple-caption-strong text-ink-muted-80 px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3 apple-caption-strong text-ink">
                      <a
                        href={gmtiMapsUrl(p)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-blue"
                      >
                        {p.name}
                      </a>
                    </td>
                    <td className="px-4 py-3 apple-caption text-ink-muted-80">{p.kind}</td>
                    <td className="px-4 py-3 apple-caption text-ink-muted-80">
                      {[p.district, p.city].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <PillarBadge p={p.pillar} />
                    </td>
                    <td className="px-4 py-3 apple-caption text-ink-muted-48">
                      {p.dataset}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > shown.length && (
          <div className="mt-10 text-center">
            <button
              onClick={() => setLimit((n) => n + PAGE)}
              className="press-scale pill-secondary"
            >
              Tampilkan {idNum(Math.min(PAGE, filtered.length - shown.length))} lagi
              <span className="text-ink-muted-48">
                {" "}
                · {idNum(shown.length)}/{idNum(filtered.length)}
              </span>
            </button>
          </div>
        )}
      </section>

      {/* ── SUMBER & BATASAN ── */}
      <section className="border-t border-hairline bg-parchment">
        <div className="mx-auto max-w-[1280px] px-6 py-12 grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="apple-caption-strong text-ink">Sumber data</h2>
            <p className="apple-caption text-ink-muted-80 mt-2">
              Fasilitas ibadah:{" "}
              <a
                href={GMTI_META.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="link-blue"
              >
                {GMTI_META.source} ↗
              </a>{" "}
              — seluruh tipologi masjid & mushalla Provinsi DKI Jakarta, snapshot{" "}
              {snapshotDate(GMTI_META.fetchedAt)}. Ekosistem halal: dataset sekunder
              Dispar yang tayang di katalog <a href="/sdi" className="link-blue">/sdi</a>.
            </p>
          </div>
          <div>
            <h2 className="apple-caption-strong text-ink">Yang perlu diketahui</h2>
            <ul className="apple-caption text-ink-muted-80 mt-2 space-y-1.5 list-disc pl-4">
              <li>
                SIMAS adalah data <em>registrasi</em> Kemenag, bukan sensus lapangan —
                fasilitas yang belum didaftarkan tidak muncul.
              </li>
              <li>
                SIMAS tidak menyediakan koordinat. {idNum(GMTI_META.ibadahBerkoordinat)}{" "}
                titik dicarikan lewat penelusuran; {idNum(GMTI_META.ibadahNonSignature)}{" "}
                fasilitas lingkungan ({["Masjid Jami", "Mushalla Perumahan"].join(" & ")})
                sengaja tidak dipetakan karena alamatnya rawan meleset.
              </li>
              <li>
                Pengelompokan pilar di halaman ini kerangka kerja kami untuk menyusun
                data — GMTI resmi menilai di tingkat negara/destinasi, bukan per
                fasilitas.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

/** Dipakai GmtiMapView untuk menandai tipologi yang memang tak dipetakan. */
export { isNonSignature };
