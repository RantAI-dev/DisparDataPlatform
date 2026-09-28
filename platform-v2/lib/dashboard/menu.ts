/** Struktur menu Dashboard Statistik (MoM 21 Sep 2026) — dipakai Nav & sub-nav. */
export const DASHBOARD_MENU = [
  {
    group: "Kinerja Pariwisata",
    items: [
      { href: "/dashboard/wisman", label: "Wisatawan Mancanegara", sub: "2024–2026 · tahunan & bulanan" },
      { href: "/dashboard/wisnus", label: "Wisatawan Nusantara", sub: "kota tujuan · lama menginap" },
    ],
  },
  {
    group: "Kinerja Ekonomi Kreatif",
    items: [
      { href: "/dashboard/pdrb-ekraf", label: "PDRB Ekonomi Kreatif", sub: "2017–2025 · kontribusi vs target RPJMD" },
      { href: "/dashboard/tenaga-kerja", label: "Tenaga Kerja Ekraf", sub: "jumlah · subsektor · tren" },
    ],
  },
] as const;
