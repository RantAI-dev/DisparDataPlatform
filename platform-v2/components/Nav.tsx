"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DASHBOARD_MENU } from "@/lib/dashboard/menu";

const ORANGE = "#ed6b23";
const INK = "#33302b";

const ITEMS = [
  { href: "/katalog", label: "Katalog Data" },
  { href: "/sdi", label: "SDI" },
  { href: "/gci", label: "GCI" },
  { href: "/gpci", label: "GPCI" },
  { href: "/gmti", label: "GMTI" },
  { href: "/spatial", label: "Spatial" },
  { href: "/scraped-hotels", label: "Hotel POC" },
  { href: "/docs", label: "API" },
  { href: "/ai", label: "AI" },
];

/**
 * Navigasi global: Dashboard Statistik · Katalog Data · SDI · GCI · GPCI · GMTI · Spatial · Hotel POC · API · AI.
 * Tema: dominan putih + aksen oranye (branding enjoy.jakarta.id).
 */
export function Nav() {
  const path = usePathname() || "/";
  const router = useRouter();
  const showBack = path !== "/";
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#ece6df]">
      {/* Aksen oranye tipis di atas — identitas enjoy.jakarta */}
      <div style={{ height: 3, background: ORANGE }} />
      <div className="mx-auto max-w-[1320px] px-6 py-3 md:py-0 md:h-[74px] flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          {/* Kembali — global, ke halaman sebelumnya. Sembunyi di beranda. */}
          {showBack && (
            <button
              onClick={() => router.back()}
              aria-label="Kembali ke halaman sebelumnya"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg pl-1.5 pr-2.5 py-2 text-[13px] font-medium text-[#6b6459] hover:text-[#1c1a17] hover:bg-black/[0.04] transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span className="hidden sm:inline">Kembali</span>
            </button>
          )}
          <Link href="/" className="flex items-center gap-3.5 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-jakarta.png"
              alt="Logo Jakarta"
              className="h-11 w-auto"
            />
            <div className="leading-tight hidden sm:block">
              <div className="font-semibold tracking-tight text-[15px] text-[#1c1a17]">
                Dinas Pariwisata &amp; Ekonomi Kreatif
              </div>
              <div className="text-[12px] text-[#9c948a]">
                Provinsi DKI Jakarta · Platform Data
              </div>
            </div>
          </Link>
        </div>
        <div className="flex w-full md:w-auto items-center gap-1 min-w-0 text-[13px] font-medium">
        {/* Dashboard Statistik — di LUAR <nav> yang bisa di-scroll, supaya dropdown tidak terpotong overflow. */}
        <div className="relative group shrink-0">
          <Link
            href="/dashboard"
            className="px-3.5 py-2 rounded-lg transition-colors inline-flex items-center gap-1"
            style={path === "/dashboard" || path.startsWith("/dashboard/") ? { background: ORANGE, color: "#fff" } : { color: INK }}
          >
            Dashboard Statistik
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </Link>
          <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute left-0 top-full pt-2 z-50">
            <div className="w-[300px] max-w-[calc(100vw-48px)] rounded-xl border border-[#ece6df] bg-white p-2 shadow-lg">
              {DASHBOARD_MENU.map((g) => (
                <div key={g.group} className="py-1">
                  <div className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#9c948a]">{g.group}</div>
                  {g.items.map((it) => (
                    <Link key={it.href} href={it.href} className="block rounded-lg px-2.5 py-1.5 hover:bg-[#ed6b23]/10">
                      <div className="text-[13px] font-semibold text-[#1c1a17]">{it.label}</div>
                      <div className="text-[11px] font-normal text-[#9c948a]">{it.sub}</div>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <nav className="flex items-center gap-1 text-[13px] font-medium min-w-0 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {ITEMS.map((it) => {
            const active =
              path === it.href || path.startsWith(it.href + "/");
            return (
              <Link
                key={it.href}
                href={it.href}
                className="shrink-0 px-3.5 py-2 rounded-lg transition-colors"
                style={
                  active
                    ? { background: ORANGE, color: "#fff" }
                    : { color: INK }
                }
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
        </div>
      </div>
    </header>
  );
}
