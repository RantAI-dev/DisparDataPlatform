/**
 * Minimal i18n for the dashboard chrome. Restaurant data (names,
 * descriptions, addresses) stays in English; only the UI strings are
 * translated. Default language is Indonesian.
 */

export type Lang = "id" | "en";
export const LANGS: Lang[] = ["id", "en"];
export const DEFAULT_LANG: Lang = "id";
export const STORAGE_KEY = "dpj.lang";

export type Dict = Record<string, string>;

const id: Dict = {
  "nav.title": "Restoran Internasional",
  "nav.switch_to": "EN",
  "export.csv": "Ekspor Excel",
  "export.empty_rows": "Tidak ada data untuk diekspor — coba longgarkan filter.",
  "view.cards": "Kartu",
  "view.rows": "Daftar",
  "list.header.cuisine": "Kuliner",
  "list.header.place": "Tempat",
  "list.header.rating": "Rating",
  "list.header.price": "Harga",
  "list.header.actions": "Aksi",
  "nav.view_list": "Daftar",
  "nav.view_map": "Peta",
  "nav.view_golf": "Golf",
  "nav.section_restaurants": "Restoran",
  "nav.section_golf": "Golf",
  "nav.section_gci": "GCI",
  "nav.section_events": "Pertunjukan",

  "home.eyebrow": "DIREKTORI DKI JAKARTA",
  "home.title_a": "Direktori tempat",
  "home.title_b": "di DKI Jakarta.",
  "home.lead":
    "Jakarta Atlas adalah katalog tempat di Provinsi DKI Jakarta — restoran yang menyajikan masakan internasional dan lapangan golf — lengkap dengan koordinat dan tautan ke sumbernya.",
  "home.stat_venues": "Tempat",
  "home.stat_cuisines": "Jenis kuliner",
  "home.stat_courses": "Lapangan",
  "home.stat_curated": "Kurasi",
  "home.stat_holes": "Total holes",
  "home.choose_section": "PILIH KATEGORI",
  "home.vol1_kicker_short": "RESTORAN",
  "home.vol1_title": "Restoran Internasional",
  "home.vol1_description":
    "Restoran dan bar di lima kota DKI Jakarta plus Kepulauan Seribu yang menyajikan masakan atau minuman internasional. Disusun berdasarkan rating dan disilangkan dengan data OpenStreetMap.",
  "home.vol1_cta": "Buka direktori restoran",
  "home.vol2_kicker_short": "LAPANGAN GOLF",
  "home.vol2_title": "Lapangan Golf",
  "home.vol2_description":
    "Setiap lapangan golf di DKI Jakarta — dari Jakarta Golf Club tahun 1872 hingga Topgolf modern — lengkap dengan lokasi, jumlah hole, desainer, dan tahun berdiri.",
  "home.vol2_cta": "Buka peta golf",
  "home.footer_about":
    "Data dikumpulkan dari OpenStreetMap, Wanderlog, TripAdvisor, What's New Indonesia, dan situs resmi masing-masing tempat. Permintaan koreksi: hubungi Dinas Pariwisata dan Ekonomi Kreatif DKI Jakarta.",
  "home.footer_inspect": "INSPECT",
  "home.footer_colophon": "TIPOGRAFI",

  "map.pins_label": "titik di peta",
  "map.legend":
    "Tampilan peta menunjukkan setiap restoran dengan koordinat. Klik titik untuk melihat detail; klik cluster untuk zoom. Hanya entri dengan lokasi geografis yang muncul di sini.",
  "golf.page_title": "Lapangan Golf DKI Jakarta",
  "golf.eyebrow": "LAPANGAN GOLF",
  "golf.title_a": "Lapangan Golf.",
  "golf.title_b": "Jumlah dan lokasi.",
  "golf.lead_prefix": "Direktori",
  "golf.lead_count": "{courses} lapangan golf dan {ranges} driving range",
  "golf.lead_suffix":
    "yang beroperasi di dalam batas administratif DKI Jakarta. Lokasi dari OpenStreetMap, detail lapangan dari panduan golf publik.",
  "golf.stat_total": "Total venue",
  "golf.stat_courses": "Lapangan golf",
  "golf.stat_ranges": "Driving range",
  "golf.stat_holes": "Total holes",
  "golf.map_heading": "Peta sebaran",
  "golf.holes": "holes",
  "golf.kind_course": "Lapangan",
  "golf.kind_range": "Driving Range",
  "golf.kind_topgolf": "Topgolf",
  "golf.access_public": "Public",
  "golf.access_members": "Members",
  "golf.access_semi": "Semi-private",
  "golf.access_resort": "Resort",
  "golf.designer": "Desainer",
  "golf.est": "Dibangun",
  "golf.website": "Website",
  "golf.footer_source":
    "Lokasi: OpenStreetMap. Detail lapangan: Wanderlog, What's New Indonesia, GolfLux, Deemples Golf, Leading Courses.",
  "golf.legend_pins":
    "Angka di pin = jumlah hole. DR = driving range. TG = Topgolf.",
  "golf.selected_label": "TERPILIH",
  "golf.clear_selection": "Hapus pilihan",

  "hero.eyebrow": "JAKARTA · KULINER INTERNASIONAL",
  "hero.title_a": "Kuliner Internasional.",
  "hero.title_b": "Pilihan kami untuk Anda.",
  "hero.lead_prefix": "Daftar dari",
  "hero.lead_count": "{n} restoran dan bar",
  "hero.lead_suffix":
    "di Jakarta yang menyajikan makanan atau minuman internasional, dirangkum dari sumber publik. Setiap entri menyertakan tautan ke sumber aslinya — dan ke Google Maps.",
  "hero.cta_browse": "Telusuri direktori",
  "hero.cta_how": "Cara dibuat",

  "stat.establishments": "Tempat",
  "stat.cuisines": "Jenis kuliner",
  "stat.avg_rating": "Rata-rata rating",
  "stat.rated_count": "Sudah dinilai publik",

  "toolbar.search_placeholder": "Cari restoran di Jakarta…",
  "toolbar.cuisine_all": "Semua kuliner",
  "toolbar.city_all": "Seluruh kota",
  "city.Central Jakarta": "Jakarta Pusat",
  "city.South Jakarta": "Jakarta Selatan",
  "city.North Jakarta": "Jakarta Utara",
  "city.West Jakarta": "Jakarta Barat",
  "city.East Jakarta": "Jakarta Timur",
  "city.Kepulauan Seribu": "Kepulauan Seribu",
  "city.Tangerang": "Tangerang",
  "city.Bekasi": "Bekasi",
  "city.Depok": "Depok",
  "city.Bogor": "Bogor",
  "city.Jakarta (Other)": "Jakarta (Lainnya)",
  "toolbar.cat.all": "Semua",
  "toolbar.cat.food": "Makanan",
  "toolbar.cat.beverage": "Minuman",
  "toolbar.cat.both": "Keduanya",
  "toolbar.sort.rating": "Rating tertinggi",
  "toolbar.sort.reviews": "Paling banyak diulas",
  "toolbar.sort.name": "A–Z",

  "card.open_maps": "Buka di Maps",
  "card.source": "Sumber",
  "card.reviews": "ulasan",
  "card.open_chip": "Buka ↗",
  "card.price.$": "Hemat",
  "card.price.$$": "Kasual",
  "card.price.$$$": "Premium",
  "card.price.$$$$": "Fine dining",
  "card.source_curated": "Kurasi",
  "card.source_osm": "OSM",
  "card.source_curated_full": "Data kurasi tangan dari halaman agregator publik",
  "card.source_osm_full": "Data dari OpenStreetMap — © OSM contributors",
  "card.osm_note":
    "Data dari OpenStreetMap — beberapa detail (rating, ulasan, deskripsi) belum tersedia.",

  "empty.title": "Tidak ada hasil.",
  "empty.hint": "Coba hapus filter, atau cari",

  "verify.idle": "Verifikasi sumber",
  "verify.loading": "Memverifikasi sumber…",
  "verify.retry": "Coba lagi ↗",
  "verify.sources_live": "sumber aktif",
  "verify.error": "Tidak dapat menghubungi endpoint verifikasi.",
  "verify.reverify": "Verifikasi ulang",
  "verify.time_seconds": "{n}d lalu",
  "verify.time_minutes": "{n}m lalu",
  "verify.time_hours": "{n}j lalu",
  "verify.details.title": "Laporan ketersediaan sumber",
  "verify.details.checked": "diperiksa {date}",
  "verify.details.summary_ok":
    "Semua {total} halaman sumber merespons dengan sukses.",
  "verify.details.summary_partial":
    "{reachable} dari {total} halaman sumber merespons. {failed} diblokir atau tidak dapat dijangkau — biasanya TripAdvisor / RestaurantGuru, yang menolak pengambilan oleh bot dari sisi server. Tautan tetap berfungsi di browser.",
  "verify.details.close": "Tutup detail",
  "verify.details.status_ok": "OK",
  "verify.details.status_blocked": "blokir",

  "footer.about_title": "Tentang direktori ini",
  "footer.about_body":
    "Dirangkum dari halaman agregator publik (Wanderlog, TripAdvisor, Chope, What's New Indonesia, NOW! Jakarta) dan ulasan Google. Rating dan jumlah ulasan diambil dari sumber tersebut pada saat kompilasi. Setiap kartu menyertakan tautan kutipan. Tempat yang sudah tutup permanen telah dihapus dari daftar.",
  "footer.inspect": "Periksa",
  "footer.raw_json": "JSON mentah ↗",
  "footer.source_liveness": "Ketersediaan sumber ↗",
  "footer.coverage": "Cakupan",
  "footer.coverage.estab": "{n} tempat",
  "footer.coverage.cuisines": "{n} jenis kuliner",
  "footer.coverage.rated": "{n} dengan rating publik",
  "footer.copyright":
    "© {year} Jakarta Restaurant Data — proyek direktori publik.",
  "footer.typeface": "Diset dengan SF Pro · Inter sebagai cadangan.",
};

const en: Dict = {
  "nav.title": "International Restaurants",
  "nav.switch_to": "ID",
  "export.csv": "Export to Excel",
  "export.empty_rows": "Nothing to export — try loosening the filters.",
  "view.cards": "Cards",
  "view.rows": "List",
  "list.header.cuisine": "Cuisine",
  "list.header.place": "Place",
  "list.header.rating": "Rating",
  "list.header.price": "Price",
  "list.header.actions": "Actions",
  "nav.view_list": "List",
  "nav.view_map": "Map",
  "nav.view_golf": "Golf",
  "nav.section_restaurants": "Restaurants",
  "nav.section_golf": "Golf",
  "nav.section_gci": "GCI",
  "nav.section_events": "Performances",

  "home.eyebrow": "DKI JAKARTA DIRECTORY",
  "home.title_a": "A place directory",
  "home.title_b": "for DKI Jakarta.",
  "home.lead":
    "Jakarta Atlas is a catalogue of places across the Special Capital Region — restaurants serving international cuisine and golf courses — complete with coordinates and links back to their sources.",
  "home.stat_venues": "Venues",
  "home.stat_cuisines": "Cuisines",
  "home.stat_courses": "Courses",
  "home.stat_curated": "Curated",
  "home.stat_holes": "Total holes",
  "home.choose_section": "BROWSE BY CATEGORY",
  "home.vol1_kicker_short": "RESTAURANTS",
  "home.vol1_title": "International Restaurants",
  "home.vol1_description":
    "Restaurants and bars across the five DKI Jakarta cities and Kepulauan Seribu serving international food or beverages. Curated by rating and cross-referenced with OpenStreetMap.",
  "home.vol1_cta": "Open the restaurants directory",
  "home.vol2_kicker_short": "GOLF COURSES",
  "home.vol2_title": "Golf Courses",
  "home.vol2_description":
    "Every golf course inside DKI Jakarta — from the 1872 Jakarta Golf Club to modern Topgolf — with location, hole count, designer, and year founded.",
  "home.vol2_cta": "Open the golf map",
  "home.footer_about":
    "Data drawn from OpenStreetMap, Wanderlog, TripAdvisor, What's New Indonesia and each venue's official site. Correction requests: contact the Jakarta Tourism and Creative Economy Agency.",
  "home.footer_inspect": "INSPECT",
  "home.footer_colophon": "TYPOGRAPHY",

  "map.pins_label": "pins on map",
  "map.legend":
    "Map view shows every restaurant that has coordinates. Click a pin for details; click a cluster to zoom in. Only entries with geographic location appear here.",
  "golf.page_title": "DKI Jakarta Golf Courses",
  "golf.eyebrow": "GOLF COURSES",
  "golf.title_a": "Golf Courses.",
  "golf.title_b": "Count and location.",
  "golf.lead_prefix": "Directory of",
  "golf.lead_count": "{courses} golf courses and {ranges} driving ranges",
  "golf.lead_suffix":
    "operating within the administrative boundary of DKI Jakarta. Locations from OpenStreetMap; course details from public golf guides.",
  "golf.stat_total": "Total venues",
  "golf.stat_courses": "Golf courses",
  "golf.stat_ranges": "Driving ranges",
  "golf.stat_holes": "Total holes",
  "golf.map_heading": "Map overview",
  "golf.holes": "holes",
  "golf.kind_course": "Course",
  "golf.kind_range": "Driving Range",
  "golf.kind_topgolf": "Topgolf",
  "golf.access_public": "Public",
  "golf.access_members": "Members",
  "golf.access_semi": "Semi-private",
  "golf.access_resort": "Resort",
  "golf.designer": "Designer",
  "golf.est": "Est.",
  "golf.website": "Website",
  "golf.footer_source":
    "Locations: OpenStreetMap. Course details: Wanderlog, What's New Indonesia, GolfLux, Deemples Golf, Leading Courses.",
  "golf.legend_pins":
    "Number on pin = hole count. DR = driving range. TG = Topgolf.",
  "golf.selected_label": "SELECTED",
  "golf.clear_selection": "Clear selection",

  "hero.eyebrow": "JAKARTA · INTERNATIONAL CUISINE",
  "hero.title_a": "International Cuisine.",
  "hero.title_b": "Curated for you.",
  "hero.lead_prefix": "A web-sourced register of",
  "hero.lead_count": "{n} restaurants and bars",
  "hero.lead_suffix":
    "in Jakarta serving international food or beverages. Every entry links to its public source — and to Google Maps.",
  "hero.cta_browse": "Browse the directory",
  "hero.cta_how": "How this was built",

  "stat.establishments": "Establishments",
  "stat.cuisines": "Cuisines covered",
  "stat.avg_rating": "Average rating",
  "stat.rated_count": "Publicly rated",

  "toolbar.search_placeholder": "Search Jakarta restaurants…",
  "toolbar.cuisine_all": "All cuisines",
  "toolbar.city_all": "All cities",
  "city.Central Jakarta": "Central Jakarta",
  "city.South Jakarta": "South Jakarta",
  "city.North Jakarta": "North Jakarta",
  "city.West Jakarta": "West Jakarta",
  "city.East Jakarta": "East Jakarta",
  "city.Kepulauan Seribu": "Thousand Islands",
  "city.Tangerang": "Tangerang",
  "city.Bekasi": "Bekasi",
  "city.Depok": "Depok",
  "city.Bogor": "Bogor",
  "city.Jakarta (Other)": "Jakarta (Other)",
  "toolbar.cat.all": "All",
  "toolbar.cat.food": "Food",
  "toolbar.cat.beverage": "Beverage",
  "toolbar.cat.both": "Both",
  "toolbar.sort.rating": "Top rated",
  "toolbar.sort.reviews": "Most reviewed",
  "toolbar.sort.name": "A–Z",

  "card.open_maps": "Open in Maps",
  "card.source": "Source",
  "card.reviews": "reviews",
  "card.open_chip": "Open ↗",
  "card.price.$": "Budget",
  "card.price.$$": "Casual",
  "card.price.$$$": "Premium",
  "card.price.$$$$": "Fine dining",
  "card.source_curated": "Curated",
  "card.source_osm": "OSM",
  "card.source_curated_full": "Hand-curated from public aggregator pages",
  "card.source_osm_full": "From OpenStreetMap — © OSM contributors",
  "card.osm_note":
    "Data from OpenStreetMap — some fields (rating, reviews, description) are not yet available.",

  "empty.title": "No matches.",
  "empty.hint": "Try clearing a filter, or searching",

  "verify.idle": "Verify sources",
  "verify.loading": "Verifying sources…",
  "verify.retry": "Retry ↗",
  "verify.sources_live": "sources live",
  "verify.error": "Could not reach the verification endpoint.",
  "verify.reverify": "Re-verify",
  "verify.time_seconds": "{n}s ago",
  "verify.time_minutes": "{n}m ago",
  "verify.time_hours": "{n}h ago",
  "verify.details.title": "Source liveness report",
  "verify.details.checked": "checked {date}",
  "verify.details.summary_ok":
    "All {total} source pages responded successfully.",
  "verify.details.summary_partial":
    "{reachable} of {total} source pages responded. {failed} blocked or unreachable — typically TripAdvisor / RestaurantGuru, which refuse server-side bot fetches. Links still work in a browser.",
  "verify.details.close": "Close details",
  "verify.details.status_ok": "OK",
  "verify.details.status_blocked": "blocked",

  "footer.about_title": "About this directory",
  "footer.about_body":
    "Compiled from public aggregator pages (Wanderlog, TripAdvisor, Chope, What's New Indonesia, NOW! Jakarta) and Google reviews. Ratings and review counts are taken from those sources at the time of compilation. Every card carries citation links. Permanently-closed venues from those lists have been omitted.",
  "footer.inspect": "Inspect",
  "footer.raw_json": "Raw JSON ↗",
  "footer.source_liveness": "Source liveness ↗",
  "footer.coverage": "Coverage",
  "footer.coverage.estab": "{n} establishments",
  "footer.coverage.cuisines": "{n} cuisine labels",
  "footer.coverage.rated": "{n} with public ratings",
  "footer.copyright":
    "© {year} Jakarta Restaurant Data — public directory project.",
  "footer.typeface": "Set in SF Pro · Inter fallback.",
};

export const DICT: Record<Lang, Dict> = { id, en };

export function translate(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>
): string {
  let s = DICT[lang]?.[key] ?? DICT.en[key] ?? key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    });
  }
  return s;
}
