# Booking.com → Jakarta hotel availability — POC scraper

> **⚠️ RESEARCH-GRADE POC. Not for production use.**
>
> This script is a **research** tool to validate data shape and integration
> patterns before pursuing a **legitimate data partnership** with Booking.com
> via their [Demand API](https://join.booking.com/partnerhub).
>
> Booking.com's [Terms of Service](https://www.booking.com/content/terms.en-gb.html)
> prohibit automated access without prior written approval. We do this only
> because no public dataset of Jakarta hotel availability exists yet, and the
> data we extract (hotel name, address, star rating, review score, public price,
> room count when visible without login) is the same data Booking.com renders
> publicly for any visitor.

## What this is

A polite, rate-limited Playwright scraper that:

1. Queries Booking.com's **public search results** for "Jakarta" (no login)
2. Visits each hotel's **public detail page** (no login)
3. **Strict-filters** results to hotels physically in DKI Jakarta province
   (rejects Tangerang, Depok, Bekasi, Bogor — Jabodetabek non-DKI)
4. Writes the results into the lakehouse ClickHouse at
   `serving.mart_hotel_scraped_booking` for analysis

## Safeguards built in

| Layer | Implementation |
|---|---|
| **Honest identity** | Real Chrome User-Agent + custom `X-Research-Bot: dispar-jakarta-poc (+email)` header (Booking.com treats unusual UAs as a bot signal and redirects them; the custom header keeps us transparent — anyone inspecting the request can see who we are) |
| **robots.txt** | Fetches & parses at startup; aborts if our paths are disallowed |
| **Rate limit** | 4 s between search requests, 6 s before each detail page, ±20 % jitter |
| **Hard caps** | `SCRAPE_MAX_PAGES=4`, `SCRAPE_MAX_HOTELS=60` per run |
| **Block detection** | Stops immediately on HTTP 403 / 429 — no retry-to-bypass |
| **Cloudflare detection** | Detects challenge page ("Just a moment…"), stops the run |
| **Jakarta filter** | 2-layer filter: address keywords + bounding box. Rejects Jabodetabek non-DKI |
| **Data hygiene** | TTL 30 days, sandbox table name `_scraped_booking` |
| **No distribution** | Data stays in local ClickHouse — never published or republished |
| **No bypassing** | If we get blocked we **walk away** — no rotating proxies, no stealth plugins |

## Compliance with Booking.com robots.txt

At time of writing, `https://www.booking.com/robots.txt` allows
`User-agent: *` to access:
- `/searchresults.html` ✓
- `/hotel/<slug>.html` ✓

It only disallows `/alt_avail*` and `/fragment.*` (we never hit those).

## Data extracted

| Field | Source | Example |
|---|---|---|
| `hotel_id` | URL slug | `the-ritz-carlton-jakarta` |
| `hotel_name` | Search card | "The Ritz-Carlton Jakarta, Pacific Place" |
| `hotel_url` | Detail URL | `https://www.booking.com/hotel/id/...` |
| `address` | Detail page | "Jl. Lingkar Mega Kuningan Kav. E1.1 No. 1, Jakarta" |
| `city` | Filter result | "Jakarta Selatan" |
| `latitude` / `longitude` | Detail page (`data-atlas-latlng` or ld+json) | -6.2245, 106.8295 |
| `distance_km` | Haversine from (-6.2088, 106.8456) | 3.2 |
| `star_rating` | Star badge | 5 |
| `review_score` | "8.7 / 10" widget | 8.7 |
| `review_label` | "Fabulous" / "Very good" | "Fabulous" |
| `review_count` | "2,341 reviews" | 2341 |
| `price_idr` | Public price, converted to IDR | 1850000 |
| `price_currency` | Original | "IDR" or "USD" |
| `price_raw` | As displayed | "Rp 1.850.000" |
| `rooms_left` | "Only 2 rooms left" badge | 2 |
| `total_room_types` | Count of `[data-room-id]` | 8 |
| `is_available` | Sold-out detection | 1 / 0 |
| `checkin` / `checkout` / `adults` | Search params | as supplied |

## Quick start

```bash
cd scripts/scrapers/booking-jakarta
cp .env.example .env             # edit CH creds + scrape limits
bun install                       # Playwright + @clickhouse/client
bunx playwright install chromium  # one-time browser install
bun run smoke                     # verify CH + robots.txt OK
bun run start                     # actual run
```

## What we DON'T do

- ❌ No login / authenticated endpoints
- ❌ No `/alt_avail*` AJAX endpoints (booking.com explicitly disallows)
- ❌ No proxy rotation / IP spoofing
- ❌ No persistence of scraped HTML pages
- ❌ No redistribution or republication
- ❌ No automation that would harm Booking.com's service

## Exit strategy → Booking.com Demand API

Once the POC proves the data shape, the right path is:

1. **Apply for partnership** via [join.booking.com/partnerhub](https://join.booking.com/partnerhub)
   - Free tier, no cost, gives access to Demand API (search availability,
     pricing, hotel content) and Connectivity APIs
2. **Replace this scraper** with a thin API client that calls the Demand API
3. **Keep the ClickHouse schema** — same fields, just different source column
4. **Deprecate** `mart_hotel_scraped_booking`, rename to `mart_hotel_ota_booking`
   with `source = 'booking-demand-api'`

Total transition effort: ~1 week including partnership approval (which takes
2-4 weeks from application).

## Why not the others?

| Platform | Why rejected for POC |
|---|---|
| **Traveloka** | Strict ToS + active enforcement (2019 incident) |
| **Tiket.com** | Less enforcement but harder DOM, less stable URLs |
| **Agoda** | Aggressive bot detection, similar ToS issues |
| **Hotels.com** | Same CFAA-style ToS as Booking.com |

Booking.com is chosen because: (a) robots.txt doesn't block our paths,
(b) data is publicly visible without login, (c) Demand API gives us a clean
exit path, (d) it's the most documented platform for this kind of research.

## License & contribution

This POC is internal to Dispar DKI Jakarta. Do not redistribute. Questions?
`research@dispar.jakarta.go.id`
