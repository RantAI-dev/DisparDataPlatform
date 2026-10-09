"use client";

import { useRouter, usePathname } from "next/navigation";

/** Filter tahun berbasis query string `?tahun=` — halaman server membacanya lewat searchParams. */
export function TahunFilter({ years, value }: { years: string[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <label className="flex items-center gap-2 text-[13px] text-ink-muted-48">
      <span className="font-mono text-[11px] uppercase tracking-wider">Tahun</span>
      <select
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          router.replace(v ? `${pathname}?tahun=${encodeURIComponent(v)}` : pathname, { scroll: false });
        }}
        className="rounded-lg border border-hairline bg-white px-3 py-1.5 text-[13px] font-medium text-ink"
      >
        <option value="">Semua tahun</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}
