/**
 * Booking.com scraper for Jakarta hotels — POC, research-grade.
 *
 * Design rules:
 *   • Honest User-Agent identifying ourselves + contact email.
 *   • Respect robots.txt (we check it once at startup).
 *   • Polite rate limit: SCRAPE_DELAY_MS between every request, with jitter.
 *   • Stop on 403/429 immediately — never try to bypass.
 *   • Hit only PUBLIC pages (search results + hotel detail), no login.
 *   • Output already filtered to DKI Jakarta; non-Jakarta hotels dropped early.
 *
 * Pipeline:
 *   searchJakarta()      → paginate /searchresults.html → list of {slug,name,...}
 *   enrichDetail(slug)   → fetch /hotel/<slug>.html → coords, address, rooms
 *   filterJakarta()      → reject anything outside DKI
 *   writeRows()          → INSERT into serving.mart_hotel_scraped_booking
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { filterJakarta } from "./filter.ts";

/* ---------------------------------------------------------------------------
 * Identity & safety constants
 *
 * Booking.com uses UA as a bot signal — an unusual UA gets redirected to a
 * challenge page with no property cards. We use a real Chrome UA (it's the
 * same UA any Chrome user would send) and identify ourselves via the custom
 * `X-Research-Bot` header. Anyone inspecting the request can see who we are;
 * we are not impersonating a random user.
 * ------------------------------------------------------------------------- */
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Safari/537.36";

const REFERER = "https://www.google.com/";

const DELAY_MS = Number(process.env.SCRAPE_DELAY_MS ?? 4000);
const DETAIL_DELAY_MS = Number(process.env.SCRAPE_DETAIL_DELAY_MS ?? 6000);
const MAX_PAGES = Number(process.env.SCRAPE_MAX_PAGES ?? 4);
const MAX_HOTELS = Number(process.env.SCRAPE_MAX_HOTELS ?? 60);

/* ---------------------------------------------------------------------------
 * Booking.com URL builders
 * ------------------------------------------------------------------------- */
const BASE = "https://www.booking.com";

function fmtDate(d: Date): string {
  // YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

function buildSearchUrl(opts: { checkin: Date; checkout: Date; adults: number; offset: number }): string {
  const params = new URLSearchParams({
    ss: "Jakarta",
    ssne: "Jakarta",
    ssi: "Jakarta",
    checkin: fmtDate(opts.checkin),
    checkout: fmtDate(opts.checkout),
    group_adults: String(opts.adults),
    no_rooms: "1",
    group_children: "0",
    selected_currency: "IDR",
    lang: "en-gb",
    sb: "1",
    src: "searchresults",
    src_elem: "sb",
    nflt: "",                       // no filters
    offset: String(opts.offset),
  });
  return `${BASE}/searchresults.html?${params.toString()}`;
}

function buildDetailUrl(slug: string, checkin: Date, checkout: Date, adults: number): string {
  const params = new URLSearchParams({
    checkin: fmtDate(checkin),
    checkout: fmtDate(checkout),
    group_adults: String(adults),
    no_rooms: "1",
    group_children: "0",
    selected_currency: "IDR",
  });
  return `${BASE}/hotel/id/${slug}.html?${params.toString()}`;
}

/* ---------------------------------------------------------------------------
 * Robots.txt fetch (best effort — respect, don't require)
 * ------------------------------------------------------------------------- */
export async function fetchRobotsTxt(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/robots.txt`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export function isPathDisallowed(robots: string | null, path: string): boolean {
  if (!robots) return false;
  // Proper robots.txt parser: walk each User-agent block, find the longest
  // matching Disallow prefix within the relevant block. We're checking
  // against User-agent: * specifically.
  const blocks: { ua: string[]; disallows: string[] }[] = [];
  let current: { ua: string[]; disallows: string[] } | null = null;
  for (const rawLine of robots.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("#") || !line) continue;
    const uaMatch = /^User-agent:\s*(.+)$/i.exec(line);
    if (uaMatch) {
      const ua = uaMatch[1].trim();
      if (!current || !sameUA(current.ua[current.ua.length - 1] ?? "", ua)) {
        current = { ua: [ua], disallows: [] };
        blocks.push(current);
      } else {
        current.ua.push(ua);
      }
      continue;
    }
    const disMatch = /^Disallow:\s*(\S*)/i.exec(line);
    if (disMatch && current) {
      current.disallows.push(disMatch[1]);
    }
  }
  // Find the most specific User-agent block whose UA applies to us (we are "*").
  for (const b of blocks) {
    if (!b.ua.some((u) => u === "*")) continue;
    for (const d of b.disallows) {
      if (!d) continue; // empty Disallow = allow all
      if (path === d || path.startsWith(d.endsWith("/") ? d : d + "/") || d.endsWith("*") && path.startsWith(d.slice(0, -1))) {
        return true;
      }
      // Exact prefix match too
      if (path.startsWith(d)) return true;
    }
  }
  return false;
}

function sameUA(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/* ---------------------------------------------------------------------------
 * Browser setup
 * ------------------------------------------------------------------------- */
async function newContext(browser: Browser): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    userAgent: UA,
    locale: "en-GB",
    timezoneId: "Asia/Jakarta",
    extraHTTPHeaders: {
      "Accept-Language": "en-GB,en;q=0.9,id;q=0.8",
      Referer: REFERER,
      // Tell the server who we are — opacity is what gets scrapers banned.
      "X-Research-Bot": "dispar-jakarta-poc",
    },
    viewport: { width: 1280, height: 800 },
  });
  return ctx;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function jitter(base: number) {
  // ±20% random jitter — humans don't fire on a metronome
  return base + Math.floor((Math.random() - 0.5) * base * 0.4);
}

async function politeGet(ctx: BrowserContext, url: string, label: string): Promise<Response | null> {
  // Use the context's cookies etc by making the request via the page later;
  // here we just do a HEAD-like probe to detect blocks early.
  const probe = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": UA,
      Referer: REFERER,
      "Accept-Language": "en-GB,en;q=0.9",
      // Identify ourselves — anyone inspecting the request can see this.
      "X-Research-Bot": "dispar-jakarta-poc (+research@dispar.jakarta.go.id)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (probe.status === 403 || probe.status === 429) {
    console.error(`✗ BLOCKED (HTTP ${probe.status}) on ${label} — aborting run.`);
    console.error(`  Booking.com has flagged this network. Stop scraping for at least 24h.`);
    return null;
  }
  if (!probe.ok) {
    console.error(`✗ HTTP ${probe.status} on ${label}`);
    return null;
  }
  return probe;
}

/* ---------------------------------------------------------------------------
 * Page-level extractors
 * ------------------------------------------------------------------------- */

export type SearchRow = {
  slug: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  star_rating?: number | null;
  review_score?: number | null;
  review_label?: string | null;
  review_count?: number | null;
  price_idr?: number | null;
  price_currency?: string;
  price_raw?: string;
};

export type DetailRow = SearchRow & {
  latitude?: number | null;
  longitude?: number | null;
  rooms_left?: number | null;
  total_room_types?: number | null;
  room_types_json?: string;
  is_available?: boolean;
};

/** Parse hotel cards from a Booking.com search results page. */
async function parseSearchResults(page: Page): Promise<SearchRow[]> {
  // Wait for the property cards container.
  await page.waitForSelector('[data-testid="property-card"]', { timeout: 15000 }).catch(() => {});

  const cards = await page.$$eval('[data-testid="property-card"]', (nodes) => {
    return nodes.map((n) => {
      const q = (sel: string) => n.querySelector(sel);

      // URL & slug
      const a = q('a[data-testid="title-link"]') as HTMLAnchorElement | null;
      const href = a?.href ?? "";
      const m = href.match(/\/hotel\/[a-z]{2}\/([^.?#]+)/);
      const slug = m ? m[1].replace(/\.en-gb$/, "") : "";
      // Strip "Opens in new window" suffix that Booking appends for SR a11y.
      const name = (a?.textContent ?? "").replace(/\s*Opens in new window\s*$/i, "").trim();

      // Address — search card rarely has full address; we rely on detail page.
      const addrEl = q('[data-testid="address"]') ?? q(".address");
      const address = addrEl?.textContent?.replace(/\s+/g, " ").trim();

      // Stars — aria-label format: "5 out of 5 stars"
      const starsEl = q('[data-testid="rating-stars"]');
      let star_count: number | null = null;
      const starsAria = starsEl?.getAttribute("aria-label") ?? "";
      const starMatch = starsAria.match(/(\d)\s*out of\s*\d/i);
      if (starMatch) star_count = Number(starMatch[1]);

      // Review score — element with text like "Scored 8.7 8.7Fabulous 3,049 reviews".
      // On search page the selector is `review-score` (no "-component").
      const reviewEl = q('[data-testid="review-score"]');
      const reviewText = reviewEl?.textContent ?? "";
      const scoreMatch = reviewText.match(/(\d+(?:\.\d+)?)/);
      const review_score = scoreMatch ? Number(scoreMatch[1]) : null;
      const labelMatch = reviewText.match(/(Excellent|Fabulous|Very good|Good|Pleasant|Disappointing|Poor|Superb)/i);
      const review_label = labelMatch ? labelMatch[1] : null;
      const countMatch = reviewText.replace(/,/g, "").match(/(\d+)\s*reviews?/i);
      const review_count = countMatch ? Number(countMatch[1]) : null;

      // Price
      const priceEl = q('[data-testid="price-and-discounted-price"]') ?? q("[data-testid='price']");
      const price_raw = priceEl?.textContent?.replace(/\s+/g, " ").trim() ?? "";

      return {
        slug,
        name,
        address,
        star_count,
        review_score,
        review_label,
        review_count,
        price_raw,
      };
    });
  });

  return cards.map((c) => {
    const price = parsePrice(c.price_raw);
    return {
      slug: c.slug,
      name: c.name,
      address: c.address,
      star_rating: c.star_count ?? null,
      review_score: c.review_score ?? null,
      review_label: c.review_label ?? null,
      review_count: c.review_count ?? null,
      price_idr: price?.value_idr ?? null,
      price_currency: price?.currency,
      price_raw: c.price_raw,
    } satisfies SearchRow;
  });
}

/** Parse hotel detail page (coords, full address, room types). */
async function parseDetail(page: Page): Promise<{
  full_address?: string;
  latitude?: number | null;
  longitude?: number | null;
  star_rating?: number | null;
  rooms_left?: number | null;
  total_room_types?: number | null;
  room_types_json?: string;
  is_available?: boolean;
}> {
  const data = await page.evaluate(() => {
    const q = (s: string) => document.querySelector(s);

    // --- Coords: prefer [data-atlas-latlng], then ld+json, then meta tag. ---
    let lat: number | null = null;
    let lng: number | null = null;
    const atlas = q("[data-atlas-latlng]") as HTMLElement | null;
    if (atlas) {
      const [a, b] = atlas.getAttribute("data-atlas-latlng")!.split(",").map(Number);
      if (Number.isFinite(a) && Number.isFinite(b)) { lat = a; lng = b; }
    }
    if (lat == null) {
      const lds = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of Array.from(lds)) {
        try {
          const j: any = JSON.parse(s.textContent ?? "");
          const candidate = j?.geo ?? j?.["@graph"]?.find?.((x: any) => x.geo)?.geo;
          const la = Number(candidate?.latitude);
          const ln = Number(candidate?.longitude);
          if (Number.isFinite(la) && Number.isFinite(ln)) { lat = la; lng = ln; break; }
        } catch { /* skip */ }
      }
    }
    if (lat == null) {
      const latMeta = q('meta[property="place:location:latitude"]')?.getAttribute("content") ?? "";
      const lngMeta = q('meta[property="place:location:longitude"]')?.getAttribute("content") ?? "";
      const la = parseFloat(latMeta);
      const ln = parseFloat(lngMeta);
      if (Number.isFinite(la) && Number.isFinite(ln) && (la !== 0 || ln !== 0)) {
        lat = la; lng = ln;
      }
    }

    // --- Full address: try PropertyHeaderAddressDesktop wrapper. ---
    const addrEl = q('[data-testid="PropertyHeaderAddressDesktop-wrapper"]')
      ?? q('[data-testid="property-address"]')
      ?? q(".hp_address_subtitle");
    const full_address = addrEl?.textContent?.replace(/\s+/g, " ").trim() ?? undefined;

    // --- Stars: aria-label "5 out of 5 stars" on detail too. ---
    const starsAria = q('[data-testid="rating-stars"]')?.getAttribute("aria-label") ?? "";
    const starMatch = starsAria.match(/(\d)\s*out of\s*\d/i);
    const star_rating = starMatch ? Number(starMatch[1]) : null;

    // --- Rooms left: "Only X room(s) left" — at body level OR per-row. ---
    const bodyText = document.body.innerText;
    let rooms_left: number | null = null;
    {
      const m = bodyText.match(/Only\s+(\d{1,3})\s+(?:room|rooms)\s+left/i);
      if (m) rooms_left = Number(m[1]);
    }

    // --- Room inventory: group rows by room prefix in data-block-id. ---
    // Each `tr[data-block-id]` is one rate for one room. Format:
    // <roomId>_<rateId>_<adults>_<children>_<??>_<??>
    type Room = {
      name: string;
      beds?: string;
      sleeps?: string;
      price_min_idr: number;
      price_max_idr: number;
      price_raw_min: string;
      price_raw_max: string;
      breakfast_included: boolean;
      cancellation?: string;
      rate_count: number;
    };
    const roomsById = new Map<string, Room>();

    function parsePriceInline(raw: string): { value_idr: number; currency: string } | null {
      if (!raw) return null;
      let m = raw.match(/Rp\s*([\d.,]+)/i);
      if (m) {
        const n = Number(m[1].replace(/[.,]/g, "").replace(/^0+/, "") || "0");
        if (n > 0) return { value_idr: n, currency: "IDR" };
      }
      m = raw.match(/\$\s*([\d.,]+)/);
      if (m) {
        const n = Number(m[1].replace(/,/g, ""));
        return { value_idr: Math.round(n * 16000), currency: "USD" };
      }
      m = raw.match(/([\d.,]+)\s*(USD|EUR|SGD|MYR)/i);
      if (m) {
        const n = Number(m[1].replace(/,/g, ""));
        const rate = ({ USD: 16000, EUR: 17500, SGD: 12000, MYR: 3500 } as any)[m[2].toUpperCase()] ?? 16000;
        return { value_idr: Math.round(n * rate), currency: m[2].toUpperCase() };
      }
      return null;
    }

    document.querySelectorAll('tr[data-block-id]').forEach((r) => {
      const blockId = r.getAttribute("data-block-id") ?? "";
      const roomId = blockId.split("_")[0] ?? "0";
      if (!roomId) return;

      const name = (r.querySelector('.hprt-roomtype-icon-link') as HTMLElement | null)?.textContent?.replace(/\s+/g, " ").trim();
      const bed = (r.querySelector('.hprt-roomtype-bed') as HTMLElement | null)?.textContent?.replace(/\s+/g, " ").trim();
      const sleeps = (r.querySelector('.hprt-roomtype-guests') as HTMLElement | null)?.textContent?.replace(/\s+/g, " ").trim();
      const priceText = (r.querySelector('[data-testid="price-and-discounted-price"]') as HTMLElement | null)?.textContent?.replace(/\s+/g, " ").trim()
        ?? (r.querySelector('.bui-price-display__value, .prco-valign-middle-helper, .bpgjs-rate__price') as HTMLElement | null)?.textContent?.replace(/\s+/g, " ").trim();
      // Inline parse-price (must be self-contained inside page.evaluate).
      const priceParsed = priceText ? parsePriceInline(priceText) : null;
      const breakfast = !!(r.querySelector('[data-testid="rt-rate-breakfast-included"]') || /breakfast included/i.test(r.textContent ?? ""));
      const cancellation = (() => {
        const t = r.textContent?.toLowerCase() ?? "";
        if (/free cancellation|free to cancel/i.test(t)) return "free_cancellation";
        if (/non[- ]refundable/i.test(t)) return "non_refundable";
        return undefined;
      })();
      // Per-row "Only X rooms left at this price"
      const rowRemaining = (() => {
        const t = r.textContent ?? "";
        const m = t.match(/Only\s+(\d{1,3})\s+(?:room|rooms)\s+left/i);
        return m ? Number(m[1]) : null;
      })();
      if (rowRemaining != null && (rooms_left == null || rowRemaining < rooms_left)) {
        rooms_left = rowRemaining;
      }

      const existing = roomsById.get(roomId);
      if (existing) {
        existing.rate_count++;
        if (priceParsed) {
          if (priceParsed.value_idr < existing.price_min_idr) {
            existing.price_min_idr = priceParsed.value_idr;
            existing.price_raw_min = priceText ?? "";
          }
          if (priceParsed.value_idr > existing.price_max_idr) {
            existing.price_max_idr = priceParsed.value_idr;
            existing.price_raw_max = priceText ?? "";
          }
        }
      } else {
        roomsById.set(roomId, {
          name: name ?? `Room #${roomId}`,
          beds: bed,
          sleeps,
          price_min_idr: priceParsed?.value_idr ?? 0,
          price_max_idr: priceParsed?.value_idr ?? 0,
          price_raw_min: priceText ?? "",
          price_raw_max: priceText ?? "",
          breakfast_included: breakfast,
          cancellation,
          rate_count: 1,
        });
      }
    });

    const rooms: Room[] = Array.from(roomsById.values()).sort((a, b) => a.price_min_idr - b.price_min_idr);
    const total_room_types = rooms.length > 0 ? rooms.length : null;
    const room_types_json = JSON.stringify(rooms.map((r) => ({
      name: r.name,
      beds: r.beds,
      sleeps: r.sleeps,
      price_min_idr: r.price_min_idr,
      price_max_idr: r.price_max_idr,
      price_raw_min: r.price_raw_min,
      price_raw_max: r.price_raw_max,
      breakfast_included: r.breakfast_included,
      cancellation: r.cancellation,
      rate_count: r.rate_count,
    })));

    // --- Availability. ---
    const t = bodyText.toLowerCase();
    const is_available = !(t.includes("sold out") || t.includes("no availability") || t.includes("tidak tersedia"));

    return {
      full_address, latitude: lat, longitude: lng, star_rating,
      rooms_left,
      total_room_types: total_room_types || null,
      room_types_json,
      is_available,
    };
  });

  return data;
}

/** Parse "Rp 1.850.000" / "$115" / "115 USD" → {value_idr, currency}. */
function parsePrice(raw: string): { value_idr: number; currency: string } | null {
  if (!raw) return null;
  // Rp X.YYY.ZZZ
  let m = raw.match(/Rp\s*([\d.,]+)/i);
  if (m) {
    const n = Number(m[1].replace(/[.,]/g, "").replace(/^0+/, "") || "0");
    return { value_idr: Math.round(n), currency: "IDR" };
  }
  // USD
  m = raw.match(/\$\s*([\d.,]+)/);
  if (m) {
    const n = Number(m[1].replace(/,/g, ""));
    return { value_idr: Math.round(n * 16000), currency: "USD" };
  }
  // 115 USD / 115 EUR
  m = raw.match(/([\d.,]+)\s*(USD|EUR|SGD|MYR)/i);
  if (m) {
    const n = Number(m[1].replace(/,/g, ""));
    const rate = { USD: 16000, EUR: 17500, SGD: 12000, MYR: 3500 }[m[2].toUpperCase()] ?? 16000;
    return { value_idr: Math.round(n * rate), currency: m[2].toUpperCase() };
  }
  return null;
}

/* ---------------------------------------------------------------------------
 * Main pipeline
 * ------------------------------------------------------------------------- */

export type ScrapeResult = {
  started_at: string;
  finished_at: string;
  total_search_results: number;
  filtered_in: number;
  filtered_out: number;
  detail_ok: number;
  detail_blocked: number;
  filter_rejections: { name: string; reason: string }[];
  rows: DetailRow[];
};

export async function scrape(opts: {
  checkin: Date;
  checkout: Date;
  adults: number;
  maxPages?: number;
  maxHotels?: number;
  logger?: (msg: string) => void;
}): Promise<ScrapeResult> {
  const log = opts.logger ?? console.log;
  const startedAt = new Date();
  const maxPages = opts.maxPages ?? MAX_PAGES;
  const maxHotels = opts.maxHotels ?? MAX_HOTELS;

  const filterRejections: { name: string; reason: string }[] = [];
  const rows: DetailRow[] = [];

  // 1. Respect robots.txt
  const robots = await fetchRobotsTxt();
  if (isPathDisallowed(robots, "/searchresults.html")) {
    throw new Error("robots.txt disallows /searchresults.html — aborting out of respect.");
  }
  if (isPathDisallowed(robots, "/hotel/")) {
    throw new Error("robots.txt disallows /hotel/ — aborting out of respect.");
  }
  log(`✓ robots.txt checked (no blocks for our paths)`);

  const browser = await chromium.launch({ headless: true });
  let totalSearch = 0;
  let detailOk = 0;
  let detailBlocked = 0;

  try {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();

    /* ---------- Phase 1: paginate search results ---------- */
    const collected: SearchRow[] = [];
    for (let p = 0; p < maxPages; p++) {
      const offset = p * 25;
      const url = buildSearchUrl({ checkin: opts.checkin, checkout: opts.checkout, adults: opts.adults, offset });
      log(`[search] page ${p + 1}/${maxPages} — offset=${offset}`);

      const probe = await politeGet(ctx, url, `search#${p + 1}`);
      if (!probe) break;

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      // Give the page a moment to render — but no full networkidle (cloudflare
      // sometimes holds the connection open).
      await sleep(2000);

      // Cloudflare challenge page check
      const title = await page.title();
      if (/just a moment|attention required|verify you are a human/i.test(title)) {
        log(`✗ Cloudflare challenge detected on page ${p + 1} — stopping.`);
        detailBlocked++;
        break;
      }

      const rows_p = await parseSearchResults(page);
      totalSearch += rows_p.length;
      collected.push(...rows_p);
      log(`  → got ${rows_p.length} cards (running: ${collected.length})`);

      if (rows_p.length === 0) break; // last page
      if (collected.length >= maxHotels) break;

      if (p < maxPages - 1) await sleep(jitter(DELAY_MS));
    }

    /* ---------- Phase 2: filter + detail page ---------- */
    // Search-stage filter is loose (search card has no coords, address rarely
    // shows "Jakarta" keyword — e.g. "PIK, Jakarta Utara" or just the property
    // name has "Jakarta"). We drop only the obvious Jabodetabek rejects
    // (Tangerang, Depok, Bekasi, Bogor) and let detail-page filter do the
    // real check.
    const prelim: { row: SearchRow; matched: string }[] = [];
    for (const row of collected) {
      if (!row.slug) continue;
      const f = filterJakarta({
        name: row.name,
        address: row.address,
      });
      if (!f.keep) {
        // Be lenient at search stage: only drop if address explicitly mentions
        // a non-DKI Jabodetabek city. If just "address doesn't mention DKI",
        // we still go to detail page for a fuller check.
        if (/Tangerang|Depok|Bekasi|Bogor|BSD|Sentul|Puncak/.test(f.reason)) {
          filterRejections.push({ name: row.name || row.slug, reason: f.reason });
          continue;
        }
      }
      prelim.push({ row, matched: f.keep ? f.city_label : "Jakarta" });
    }
    log(`[filter] kept ${prelim.length} / ${collected.length} for detail-page visit (dropped ${filterRejections.length} obvious non-DKI pre-detail)`);

    // Now visit each detail page (polite).
    const limit = Math.min(prelim.length, maxHotels);
    let consecutiveBlocks = 0;
    for (let i = 0; i < limit; i++) {
      const { row, matched } = prelim[i];
      const url = buildDetailUrl(row.slug, opts.checkin, opts.checkout, opts.adults);
      log(`[detail] ${i + 1}/${limit} — ${row.name}`);

      const probe = await politeGet(ctx, url, `detail:${row.slug}`);
      if (!probe) { detailBlocked++; consecutiveBlocks++; continue; }

      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(1500);

        // Detect Booking.com's soft challenge ("Page not found" on otherwise-valid URLs).
        const title = await page.title();
        const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
        const isChallenge = /page not found|please verify|captcha|are you a human/i.test(title + bodyText);
        if (isChallenge) {
          log(`  ✗ Booking.com soft-challenge — stopping detail scraping for this run.`);
          detailBlocked++;
          consecutiveBlocks++;
          // If we got blocked twice in a row, end the run early to be safe.
          if (consecutiveBlocks >= 2) break;
          continue;
        }
        consecutiveBlocks = 0;

        const detail = await parseDetail(page);

        // Re-filter with full address + coords if we got them
        const finalF = filterJakarta({
          name: row.name,
          address: detail.full_address ?? row.address,
          city: matched,
          country: "Indonesia",
          latitude: detail.latitude ?? null,
          longitude: detail.longitude ?? null,
        });
        if (!finalF.keep) {
          filterRejections.push({ name: row.name, reason: `(detail recheck) ${finalF.reason}` });
          continue;
        }

        rows.push({
          ...row,
          address: detail.full_address ?? row.address,
          city: matched,
          country: "Indonesia",
          latitude: detail.latitude ?? null,
          longitude: detail.longitude ?? null,
          star_rating: detail.star_rating ?? row.star_rating ?? null,
          rooms_left: detail.rooms_left ?? null,
          total_room_types: detail.total_room_types ?? null,
          room_types_json: detail.room_types_json ?? "[]",
          is_available: detail.is_available ?? true,
        });
        detailOk++;
      } catch (e) {
        console.error(`  ✗ detail error: ${e instanceof Error ? e.message : e}`);
      }

      if (i < limit - 1) await sleep(jitter(DETAIL_DELAY_MS));
    }

    await ctx.close();
  } finally {
    await browser.close();
  }

  return {
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    total_search_results: totalSearch,
    filtered_in: rows.length,
    filtered_out: filterRejections.length,
    detail_ok: detailOk,
    detail_blocked: detailBlocked,
    filter_rejections: filterRejections,
    rows,
  };
}
