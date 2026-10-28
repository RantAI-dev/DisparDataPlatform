/**
 * Redirect lama (SPEC §5.4), satu tempat untuk semuanya. Status disamakan dengan produksi
 * (`curl -I` 28 Okt 2026: semua 307, key tak dikenal 404).
 *
 * Sumber key section: platform-v2 `lib/data-sections.ts`.
 */
export const SECTION_LAMA = {
  gci: "/gci/pariwisata/restoran-gci",
  restaurants: "/gci/pariwisata/direktori-restoran",
  pertunjukan: "/gci/pariwisata/pertunjukan-budaya",
  michelin: "/sdi/michelin-keys-indonesia",
  golf: "/gpci/lapangan-golf",
  souvenir: "/gpci/toko-suvenir",
  hotel: "/gpci/hotel",
} as const;

type Section = keyof typeof SECTION_LAMA;

const PETA_LAMA = new Set(["restaurants", "souvenir", "golf"]);

const TETAP: Readonly<Partial<Record<string, string>>> = {
  "/atlas": "/spatial",
  "/gmti/map": "/spatial",
  "/katalog/hotel": SECTION_LAMA.hotel,
  "/readiness": "/gci",
};

export type HasilRedirect = { status: 307; lokasi: string } | { status: 404 } | null;

/** null = bukan alamat lama, lanjutkan ke halaman biasa. */
export function tujuanRedirect(pathname: string): HasilRedirect {
  const tetap = Object.hasOwn(TETAP, pathname) ? TETAP[pathname] : undefined;
  if (tetap !== undefined) return { status: 307, lokasi: tetap };

  const section = /^\/atlas\/([^/]+)$/.exec(pathname)?.[1];
  if (section !== undefined) {
    return Object.hasOwn(SECTION_LAMA, section) ? { status: 307, lokasi: SECTION_LAMA[section as Section] } : { status: 404 };
  }

  const peta = /^\/atlas\/([^/]+)\/map$/.exec(pathname)?.[1];
  if (peta !== undefined) {
    return PETA_LAMA.has(peta) ? { status: 307, lokasi: "/spatial" } : { status: 404 };
  }

  return null;
}
