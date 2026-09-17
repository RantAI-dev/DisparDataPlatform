/**
 * Strict Jakarta-only filter.
 *
 * Booking.com's "Jakarta" search returns results from Greater Jakarta (Jabodetabek):
 * Tangerang, Depok, Bekasi, Bogor. For the Dispar use case we want ONLY hotels
 * physically located in DKI Jakarta province. We enforce two layers:
 *
 *   1. Address TEXT match — accept if address mentions any of the 5 kota/kapub
 *      of DKI Jakarta: Jakarta Pusat, Jakarta Selatan, Jakarta Timur,
 *      Jakarta Barat, Jakarta Utara, or short forms (Jakpus, Jaksel, dst).
 *      REJECT if address mentions Tangerang, Depok, Bekasi, Bogor, BSD, dll.
 *
 *   2. Coordinates (when present) — accept if inside the DKI Jakarta bounding
 *      box; reject otherwise. Bounding box is loose (covers Seribu Islands).
 *
 * Hotel must pass BOTH layers (when coordinates exist) or at least layer 1.
 */

const DKI_KOTA = [
  "Jakarta Pusat",
  "Jakarta Selatan",
  "Jakarta Timur",
  "Jakarta Barat",
  "Jakarta Utara",
  "Jakarta",
  // short forms
  "Jakpus", "Jaksel", "Jaktim", "Jakbar", "Jakut",
  // Special Region (capital)
  "Daerah Khusus Ibukota",
  "DKI Jakarta",
];

const REJECT_KEYWORDS = [
  // Jabodetabek cities outside DKI
  "Tangerang", "Tangerang Selatan", "Tangsel", "BSD", "Alam Sutera",
  "Gading Serpong", "Serpong", "Banten",
  "Depok",
  "Bekasi", "Cikarang", "Karawang",
  "Bogor",
  // Greater Jakarta but not DKI
  "Puncak", "Sentul", "Anyer",
];

// Bounding box for DKI Jakarta (loose, includes Seribu Islands)
const BBOX = {
  minLat: -6.40,
  maxLat: -5.90,
  minLng: 106.55,
  maxLng: 107.05,
};

export type Candidate = {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type FilterResult =
  | { keep: true; reason: string; city_label: string }
  | { keep: false; reason: string };

export function filterJakarta(c: Candidate): FilterResult {
  const haystack = [c.name, c.address ?? "", c.city ?? "", c.country ?? ""]
    .filter(Boolean)
    .join(" ");

  // 1. Explicit reject (any of these words disqualifies the candidate).
  for (const bad of REJECT_KEYWORDS) {
    if (haystack.includes(bad)) {
      return { keep: false, reason: `Rejected: contains "${bad}"` };
    }
  }

  // 2. Coordinate check (only if both present).
  if (c.latitude != null && c.longitude != null) {
    const inBox =
      c.latitude >= BBOX.minLat &&
      c.latitude <= BBOX.maxLat &&
      c.longitude >= BBOX.minLng &&
      c.longitude <= BBOX.maxLng;
    if (!inBox) {
      return { keep: false, reason: `Rejected: coords (${c.latitude}, ${c.longitude}) outside DKI bbox` };
    }
  }

  // 3. Address must mention one of DKI's administrative units.
  const matched = DKI_KOTA.find((k) => haystack.includes(k));
  if (!matched) {
    return { keep: false, reason: "Rejected: address doesn't mention any DKI administrative unit" };
  }

  return { keep: true, reason: `Matched on "${matched}"`, city_label: matched };
}
