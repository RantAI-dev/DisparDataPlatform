import { DashboardSubnav } from "@/components/dashboard/DashboardSubnav";

export const metadata = {
  title: "Dashboard Statistik Pariwisata & Ekonomi Kreatif — DKI Jakarta",
};

/** Kerangka menu Dashboard: judul + sub-menu (Kinerja Pariwisata · Kinerja Ekraf). */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1320px] px-6 py-8">
        <div className="mb-5">
          <div className="apple-fine uppercase tracking-wider text-ink-muted-48">Dashboard · Mandat RPJMD 2025–2029</div>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight text-ink">
            Dashboard Statistik Pariwisata dan Ekonomi Kreatif
          </h1>
        </div>
        <DashboardSubnav />
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
