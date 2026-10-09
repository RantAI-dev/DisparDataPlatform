import Link from "next/link";

/**
 * Kerangka halaman detail indikator PARIWISATA GCI (Pengalaman Budaya).
 * Hero gelap + breadcrumb "← GCI" + angka indikator resmi (headline) di kanan.
 * Tema: putih + oranye, link biru terang di atas hero gelap.
 */
const HERO =
  "radial-gradient(900px 320px at 88% -25%, rgba(237,107,35,0.28), transparent 62%), linear-gradient(160deg, #2a2521 0%, #16130f 100%)";
const GOLD = "#f0a13a";

export function PariwisataShell({
  eyebrow,
  title,
  nilai,
  satuan,
  tahun,
  catatan,
  sumber,
  sumberHref,
  children,
}: {
  eyebrow?: string;
  title: string;
  nilai: string;
  satuan: string;
  /** Opsional: bila kosong, meta "Tahun" dan tahun di label angka indikator disembunyikan. */
  tahun?: string;
  catatan?: string;
  sumber: string;
  sumberHref?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#faf6f2]">
      <section style={{ background: HERO }} className="text-white">
        <div className="mx-auto max-w-[1320px] px-6 pt-7 pb-10">
          <Link
            href="/gci"
            className="text-[12px] font-mono uppercase tracking-widest text-white/60 hover:text-white"
          >
            ← GCI · Pengalaman Budaya
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-[62ch]">
              {eyebrow && (
                <div className="mb-2 text-[12px] font-mono uppercase tracking-widest text-white/55">
                  <span style={{ color: GOLD }}>●</span> {eyebrow}
                </div>
              )}
              <h1 className="atlas-display text-white">{title}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-white/80">
                {tahun && <Meta label="Tahun" value={tahun} />}
                <Meta
                  label="Sumber"
                  value={sumber}
                  href={sumberHref}
                />
              </div>
              {catatan && (
                <p className="mt-4 inline-flex rounded-lg border border-white/12 bg-white/[0.04] px-3.5 py-2 text-[12px] text-white/70">
                  {catatan}
                </p>
              )}
            </div>

            {/* Angka indikator resmi — headline besar */}
            <div className="rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-5">
              <div className="apple-fine uppercase tracking-wider text-white/50">
                Angka indikator{tahun ? ` ${tahun}` : ""}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[46px] font-bold leading-none tabular text-white">
                  {nilai}
                </span>
                <span className="apple-caption text-white/60">{satuan}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] space-y-10 px-6 py-10 pb-20">
        {children}
      </section>
    </main>
  );
}

function Meta({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <span>
      <span className="text-[11px] uppercase tracking-wider text-white/50">{label}: </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-medium hover:underline"
          style={{ color: "#8ab4ff" }}
        >
          {value} ↗
        </a>
      ) : (
        <span className="font-medium" style={{ color: GOLD }}>
          {value}
        </span>
      )}
    </span>
  );
}

/** Judul + deskripsi bagian di dalam halaman indikator. */
export function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="atlas-display-md text-ink">{title}</h2>
      {desc && <p className="mt-1.5 apple-caption text-ink-muted-48 max-w-[80ch]">{desc}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
