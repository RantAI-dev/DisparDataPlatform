/** Pemilik halaman dataset, dipakai katalog, navigasi daftar, dan redirect lama. */
export const DATA_SECTIONS = {
  gci: { title: "Restoran GCI", href: "/gci/pariwisata/restoran-gci", framework: "GCI" },
  restaurants: { title: "Direktori Restoran", href: "/gci/pariwisata/direktori-restoran", framework: "GCI" },
  pertunjukan: { title: "Pertunjukan & Budaya", href: "/gci/pariwisata/pertunjukan-budaya", framework: "GCI" },
  golf: { title: "Lapangan Golf", href: "/gpci/lapangan-golf", framework: "GPCI" },
  souvenir: { title: "Toko Suvenir", href: "/gpci/toko-suvenir", framework: "GPCI" },
  hotel: { title: "Hotel & Akomodasi", href: "/gpci/hotel", framework: "GPCI" },
} as const;

export type DataSection = keyof typeof DATA_SECTIONS;
