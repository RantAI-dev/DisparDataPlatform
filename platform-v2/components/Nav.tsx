"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const ORANGE = "#ed6b23";
const INK = "#33302b";

const ITEMS = [
  { href: "/sdi", label: "Katalog" },
  { href: "/gci", label: "GCI" },
  { href: "/gpci", label: "GPCI" },
  { href: "/atlas", label: "Atlas" },
  { href: "/gmti", label: "GMTI" },
  { href: "/scraped-hotels", label: "Hotel POC" },
  { href: "/docs", label: "API" },
  { href: "/ai", label: "AI" },
];

/**
 * Navigasi global 4-menu: Katalog · GCI · GPCI · Atlas.
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
      <div className="mx-auto max-w-[1320px] px-6 h-[74px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
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
        <nav className="flex items-center gap-1 text-[13px] font-medium">
          {ITEMS.map((it) => {
            const active =
              path === it.href || path.startsWith(it.href + "/");
            return (
              <Link
                key={it.href}
                href={it.href}
                className="px-3.5 py-2 rounded-lg transition-colors"
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
    </header>
  );
}
