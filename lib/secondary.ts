import { GCI_RESTAURANTS } from "./gci";
import { GCI_EVENTS } from "./events";
import { RESTAURANTS } from "./restaurants";
import { GOLF_COURSES } from "./golf";
import tripadvisorKuliner from "../data/sekunder/restoran-tripadvisor-jakarta.json";

/**
 * Data sekunder — dataset hasil pendataan Jakarta Atlas (Dinas Pariwisata)
 * yang melengkapi data primer SDI, diarahkan untuk memenuhi indikator
 * GCI / GPCI. Tampil di katalog bersebelahan dengan data primer.
 */
export type SecondaryDataset = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  rows: number;
  href: string; // halaman tabel di Jakarta Atlas
};

export function secondaryDatasets(): SecondaryDataset[] {
  return [
    {
      id: "sec-gci-resto",
      title: "Restoran & Kafe GCI Jakarta",
      description:
        "Pendataan seluruh restoran & kafe se-Jakarta (termasuk restoran hotel bintang 3–4) untuk Global City Index.",
      tags: ["gci", "restoran", "kuliner", "sekunder"],
      rows: GCI_RESTAURANTS.length,
      href: "/gci",
    },
    {
      id: "sec-events",
      title: "Pertunjukan & Budaya GCI",
      description:
        "Pertunjukan musik internasional/nasional & acara budaya besar di Jakarta 2025–2026 (konser, festival, tari, teater, seni rupa, film) untuk Global City Index.",
      tags: ["gci", "event", "pertunjukan", "budaya", "sekunder"],
      rows: GCI_EVENTS.length,
      href: "/events",
    },
    {
      id: "sec-resto-dir",
      title: "Direktori Restoran Kurasi",
      description:
        "Direktori restoran & kafe pilihan Jakarta dengan sumber sitasi publik yang terverifikasi.",
      tags: ["restoran", "kuliner", "direktori", "sekunder"],
      rows: RESTAURANTS.length,
      href: "/restaurants",
    },
    {
      id: "sec-golf",
      title: "Lapangan Golf Jakarta",
      description:
        "Pendataan lapangan & driving range golf di Jakarta dan sekitarnya.",
      tags: ["golf", "olahraga", "wisata", "sekunder"],
      rows: GOLF_COURSES.length,
      href: "/golf",
    },
    {
      id: "sec-tripadvisor-kuliner",
      title: "Kuliner TripAdvisor Jakarta",
      description:
        "Restoran DKI Jakarta bersumber TripAdvisor untuk indikator kuliner GCI (kriteria Kearney: TripAdvisor & Michelin). Michelin belum ada di Jakarta (kolom kosong). Tabel mentah hasil crawl.",
      tags: ["gci", "kuliner", "tripadvisor", "michelin", "sekunder"],
      rows: tripadvisorKuliner.rows.length,
      href: "/gci?tab=tripadvisor",
    },
  ];
}
