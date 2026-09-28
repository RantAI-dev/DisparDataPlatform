"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DASHBOARD_MENU } from "@/lib/dashboard/menu";

/** Sub-menu dashboard: dua kelompok (Kinerja Pariwisata, Kinerja Ekraf) × 2 halaman. */
export function DashboardSubnav() {
  const path = usePathname() || "";
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {DASHBOARD_MENU.map((g) => (
        <div key={g.group} className="rounded-xl border border-hairline bg-white p-2 shadow-sm">
          <div className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted-48">
            {g.group}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {g.items.map((it) => {
              const active = path === it.href || path.startsWith(it.href + "/");
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`rounded-lg px-3 py-2 transition-colors ${active ? "text-white" : "hover:bg-black/[0.04]"}`}
                  style={active ? { background: "#ed6b23" } : undefined}
                >
                  <div className={`text-[13.5px] font-semibold ${active ? "" : "text-ink"}`}>{it.label}</div>
                  <div className={`text-[11px] ${active ? "text-white/85" : "text-ink-muted-48"}`}>{it.sub}</div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
