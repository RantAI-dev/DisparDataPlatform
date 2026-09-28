import Link from "next/link";
import { DASHBOARD_MENU } from "@/lib/dashboard/menu";
import { getWisman, TARGET_WISMAN } from "@/lib/dashboard/data";
import { PDRB_MAKRO, TARGET_KONTRIBUSI_RPJMD } from "@/lib/dashboard/pdrb-ekraf";
import { KpiStat } from "@/components/charts/KpiStat";

// Dinamis: saat build (image Docker) ClickHouse tak terjangkau — ISR akan membekukan halaman kosong.
export const dynamic = "force-dynamic";

/** Beranda Dashboard: ringkasan KPI utama + pintu ke tiap sub-menu. */
export default async function Page() {
  const w = await getWisman();
  const t2025 = w.bulanan.filter((r) => r.tahun === "2025").reduce((a, r) => a + r.jumlah, 0);
  const iK = PDRB_MAKRO.periode.indexOf("2024");
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiStat label="Wisman 2025" value={t2025 || "—"} sub={`target RPJMD ${TARGET_WISMAN["2025"].toLocaleString("id-ID")}`} />
        <KpiStat label="Kontribusi PDRB Ekraf 2024" value={`${PDRB_MAKRO.kontribusi[iK].toLocaleString("id-ID")}%`} sub={`target 2025 ${TARGET_KONTRIBUSI_RPJMD["2025"].toLocaleString("id-ID")}%`} />
        <KpiStat label="Nilai PDRB Ekraf 2024" value={`Rp ${Math.round(PDRB_MAKRO.adhbEkraf[iK] / 1000).toLocaleString("id-ID")} T`} sub="ADHB" />
        <KpiStat label="Pertumbuhan Ekraf 2024" value={`${PDRB_MAKRO.tumbuhEkraf[iK].toLocaleString("id-ID")}%`} sub={`DKI ${PDRB_MAKRO.tumbuhDki[iK].toLocaleString("id-ID")}%`} />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {DASHBOARD_MENU.flatMap((g) =>
          g.items.map((it) => (
            <Link key={it.href} href={it.href} className="utility-card block p-5 transition-shadow hover:shadow-md">
              <div className="apple-fine uppercase tracking-wider text-ink-muted-48">{g.group}</div>
              <div className="mt-1 text-[17px] font-semibold text-ink">{it.label} →</div>
              <div className="text-[13px] text-ink-muted-48">{it.sub}</div>
            </Link>
          )),
        )}
      </div>
    </>
  );
}
