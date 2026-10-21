# A — App shell, design system & shared UI (platform-v2 @ a0580ba)

Root: `/home/uaa/Dinas-Pariwisata/platform-v2`. All paths below are relative to it unless absolute.
Stack being ported: Next 15.0.7 / React 19 / Tailwind 3.4 / echarts 5.5 + echarts-for-react 3 / leaflet 1.9.4 + leaflet.markercluster 1.5.3 + react-leaflet 5 / xlsx 0.18.5 / lucide-react (AI + scraped-hotels only).
Everything was read from source. Static counts were computed from the in-repo data files. Anything not checked is marked **belum terverifikasi**.

---

## 1. Shell: layout, CSS, Tailwind, fonts, assets

### 1.1 `app/layout.tsx` (L1-41)
- Font: `Plus_Jakarta_Sans` from `next/font/google` with `subsets:["latin"]`, `variable:"--font-sans"` and `display:"swap"`. **No `weight` is passed**, so you get the variable font (all weights). Weights actually used in markup: 400, 500, 600 and 700. Next self-hosts it at build time. In Nuxt use `@nuxtjs/google-fonts` or `@fontsource-variable/plus-jakarta-sans`, and set the CSS var `--font-sans` on `<html>`.
- `<html lang="id" className={sans.variable}>`; `<body>` = `<Nav/>` + `{children}` + `<AiDock/>`. **No global footer, no providers, no theme switch.**
- Metadata:
  - title `"Dashboard Data Pariwisata & Ekraf — DKI Jakarta"`
  - description `"Platform visualisasi data terkonsolidasi Dinas Pariwisata & Ekonomi Kreatif Provinsi DKI Jakarta."`
  - icons: `/favicon.ico` (any), `/favicon-32x32.png`, `/favicon-16x16.png`, apple `/apple-touch-icon.png`
  - manifest `/site.webmanifest`
- Per-page titles:
  - `app/dashboard/layout.tsx` → "Dashboard Statistik Pariwisata & Ekonomi Kreatif — DKI Jakarta"
  - `app/docs/page.tsx` → "Dokumentasi API — Platform Data Pariwisata & Ekraf DKI Jakarta" (with its own description)

### 1.2 `tailwind.config.ts` (L1-19)
```ts
content: ["./app/**/*.{ts,tsx}","./components/**/*.{ts,tsx}","./lib/**/*.{ts,tsx}"]
colors: { navy:{DEFAULT:"#ed6b23",deep:"#c9531a"}, orange:{DEFAULT:"#ed6b23",deep:"#c9531a",soft:"#f4a06b"}, gold:"#f0a13a", civic:"#0e7c42" }
fontFamily: { sans: ["var(--font-sans)","system-ui","sans-serif"] }
```
- Note: `navy` is a legacy name that now resolves to **orange**. That is also why many components still have `const NAVY = "#ed6b23"`.
- No custom breakpoints, so the Tailwind defaults apply: sm 640, md 768, lg 1024, xl 1280, 2xl 1536.
- No plugins. `font-mono` is Tailwind's default mono stack (it is used in CatalogView/KpiStat/PariwisataShell).
- `postcss.config.mjs`: tailwindcss + autoprefixer.
- `next.config.mjs`: `reactStrictMode:true`, `output:"standalone"`. Nothing UI-relevant.

### 1.3 `app/globals.css` (L1-238) — copy verbatim into the Nuxt layer
**CSS vars (`:root`, L5-41):**
```
--canvas #ffffff; --paper #faf6f2; --paper-deep #f4ede6; --paper-light #fdfbf9; --parchment #faf6f2; --pearl #fdfbf9;
--ink #1c1a17; --ink-muted-80 #33302b; --ink-muted-48 #6b6459; --body-muted #9c948a;
--hairline #ece6df; --rule #ece6df; --rule-strong #d8cec3; --divider #f3ede6;
--accent #ed6b23; --accent-deep #c9531a; --accent-soft #f4a06b; --accent-bg rgba(237,107,35,.08); --accent-ring rgba(237,107,35,.22);
--gold #f0a13a; --link #2563eb; --link-hover #1d4ed8;
--hero: radial-gradient(900px 320px at 88% -25%, rgba(237,107,35,.28), transparent 62%), linear-gradient(160deg,#2a2521 0%,#16130f 100%);
--font-mono: ui-monospace,"JetBrains Mono",SFMono-Regular,Menlo,monospace; --font-wordmark: var(--font-sans), Georgia, serif;
color-scheme: light
```

**Base (L43-65):**
- html/body: `background var(--paper)`, `color var(--ink)`, `font-size 15px`, `line-height 1.55`, `letter-spacing -0.005em`, font var(--font-sans).
- Antialiased.
- `::selection` = accent background with white text.
- `a{color:inherit}`.

**Component classes (L67-191):**

| class | spec |
|---|---|
| `.atlas-display` / `.apple-hero` | clamp(36px,6vw,64px) / 700 / lh 1.05 / ls -0.024em |
| `.atlas-display-lg` / `.apple-display-lg` | clamp(28px,3.5vw,40px) / 700 / 1.15 / -0.018em |
| `.atlas-display-md` | clamp(22px,2.2vw,28px) / 700 / 1.2 / -0.014em |
| `.atlas-tagline` / `.apple-tagline` | 18px / 600 / 1.3 |
| `.atlas-lead` / `.apple-lead` | clamp(16px,1.4vw,18px) / 400 / 1.55, color ink-muted-80 |
| `.atlas-italic` | font-wordmark, italic, 600 |
| `.apple-body-strong` | 15/600/1.4 |
| `.apple-body` | 15/400/1.55 |
| `.apple-caption` / `.atlas-caption` | 13/400/1.45, color ink-muted-80 |
| `.apple-caption-strong` | 13/600/1.3 |
| `.apple-fine` / `.atlas-fine` | 11.5/400/1.4 |
| `.atlas-mono` / `.apple-nav-link` | mono 11px/500/lh1/ls .06em/UPPERCASE |
| `.atlas-coord` | mono 12px/500, tabular-nums, ink-muted-48 |
| `.press-scale` | transition 180ms; `:active{transform:scale(.97)}` |
| `.frosted` | rgba(255,255,255,.9) + backdrop saturate(180%) blur(14px), border-bottom hairline |
| `.utility-card` | white, 1px hairline, radius 12px, shadow `0 1px 2px rgba(15,23,42,.05)`; hover border `rgba(237,107,35,.3)` + shadow `0 8px 24px rgba(15,23,42,.08), 0 2px 4px rgba(15,23,42,.04)`; overflow hidden |

**Utility classes (L193-223)** are hand-written, **not** generated by Tailwind:
- `bg-canvas`, `bg-canvas/95`, `bg-parchment`, `bg-paper`, `bg-paper-deep`, `bg-pearl`, `bg-hairline`, `bg-ink`, `bg-ink-muted-80(/10)`
- `text-ink`, `text-ink-muted-80`, `text-ink-muted-48(/60)`, `text-body-muted`, `text-primary` (= accent), `text-link`
- `bg-hero`, `bg-primary`, `bg-primary/10`
- `border-hairline`, `border-ink-muted-48`, `border-canvas`, `border-primary`, `border-primary-focus` (= accent-soft), `border-divider`
- `rounded-apple` 12px, `rounded-apple_lg` 18px, `tabular`

⚠ Because these are plain CSS, Tailwind modifiers such as `hover:text-ink` / `group-hover:bg-primary` **do not exist** for them. In the current app those modifiers are silently no-ops. To reach pixel parity, keep them plain CSS too (do not "fix" them by adding them to the Tailwind theme, because hover states would then appear that the live app does not have). **Belum terverifikasi** per instance.

**Leaflet overrides (L225-238):**
- popup wrapper: canvas background, hairline border, radius 10px, shadow `0 8px 24px rgba(15,23,42,.12)`
- `.leaflet-container`: bg `#f6f1ec`, font var(--font-sans)

**Dark mode:** none. There are 0 `dark:` classes, no `prefers-color-scheme`, and `color-scheme: light`.

### 1.4 `public/` assets

| file | what / who uses it |
|---|---|
| `logo-jakarta.png` (449×507 RGBA) | Nav logo (`components/Nav.tsx` L61-65, `h-11 w-auto`) |
| `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` (180), `android-chrome-192x192.png`, `android-chrome-512x512.png` | layout metadata + manifest |
| `site.webmanifest` | name "Data Pariwisata & Ekonomi Kreatif — DKI Jakarta", short "Dispar Data". ⚠ `theme_color #0f3d7a` / `background_color #0a2b57` are stale navy values from the old theme |
| `geo/dki-jakarta.geojson` (45 KB) | 42 kecamatan polygons, props `{name: kota, kecamatan}` for the 5 mainland kota (no Kep. Seribu). Fetched by `GmtiMapView` L277 for the choropleth |
| `gmti-ibadah.json` (2 MB) | `{source,sourceUrl,note,fetchedAt,total,rows[8331]}`, row keys `id,card,name,address,jenis,tipologi,kota,kecamatan,lat,lon,coordSource`. Fetched by `GmtiMapView` L171 (/spatial) and the GMTI page (`lib/gmti.ts` `IBADAH_URL`). Generated by `scripts/build-gmti.ts` |

---

## 2. Navigation

### 2.1 Global nav — `components/Nav.tsx` (L1-129, client)
- **Labels are hard-coded Indonesian/acronyms; there is no i18n.**
- Constants: `ORANGE="#ed6b23"`, `INK="#33302b"`.

**Header container (L31):** `sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#ece6df]`
- 3px orange top strip: `<div style="height:3px;background:#ed6b23">`
- Inner row: `mx-auto max-w-[1320px] px-6 py-3 md:py-0 md:h-[74px] flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4`
- Desktop header height = 77px. GmtiMapView hard-codes `calc(100dvh - 78px)`, and the docs page uses `scroll-mt/top-[98px]`.

**Left side:**
- **Back button** (shown when `path !== "/"`) calls `router.back()`. Classes: `rounded-lg pl-1.5 pr-2.5 py-2 text-[13px] font-medium text-[#6b6459] hover:text-[#1c1a17] hover:bg-black/[0.04]`. Chevron SVG 16px, `path d="M15 18l-6-6 6-6"`, strokeWidth 2.2. The label "Kembali" is `hidden sm:inline`.
- **Brand link → "/"** (`flex items-center gap-3.5`):
  - logo `h-11`
  - text block `hidden sm:block`: line 1 "Dinas Pariwisata & Ekonomi Kreatif" (`font-semibold tracking-tight text-[15px] text-[#1c1a17]`); line 2 "Provinsi DKI Jakarta · Platform Data" (`text-[12px] text-[#9c948a]`)

**Right side:**
- Wrapper: `flex w-full md:w-auto items-center gap-1 min-w-0 text-[13px] font-medium`
- **"Dashboard Statistik" dropdown** (L78-104). It is kept outside the scrolling `<nav>` so the dropdown is not clipped.
  - Link `/dashboard`: `px-3.5 py-2 rounded-lg inline-flex items-center gap-1` + 10px chevron.
  - Active when `path==="/dashboard"` or `startsWith("/dashboard/")` → inline style `{background:#ed6b23,color:#fff}`; otherwise `{color:#33302b}`.
  - Opens on CSS hover/focus-within: `invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:...`, positioned `absolute left-0 top-full pt-2 z-50`.
  - Panel: `w-[300px] max-w-[calc(100vw-48px)] rounded-xl border border-[#ece6df] bg-white p-2 shadow-lg`.
  - Group heading: `px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#9c948a]`.
  - Item: `block rounded-lg px-2.5 py-1.5 hover:bg-[#ed6b23]/10`, label `text-[13px] font-semibold text-[#1c1a17]`, sub `text-[11px] text-[#9c948a]`.
  - On touch there is no JS toggle: tapping navigates to /dashboard, and the subnav there exposes the items.
- **Scrollable `<nav>`** (L105-124): `flex items-center gap-1 overflow-x-auto` with the scrollbar hidden (`[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`).
  - Each item: `shrink-0 px-3.5 py-2 rounded-lg transition-colors`.
  - Active rule: `path===href || path.startsWith(href+"/")` → orange background, white text.
  - ITEMS (L10-20), in order:

    | label | route |
    |---|---|
    | Katalog Data | `/katalog` |
    | SDI | `/sdi` |
    | GCI | `/gci` |
    | GPCI | `/gpci` |
    | GMTI | `/gmti` |
    | Spatial | `/spatial` |
    | Hotel POC | `/scraped-hotels` |
    | API | `/docs` |
    | AI | `/ai` |

  - ⚠ **AI is out of scope**: drop that item in the port.

**Mobile behaviour:** there is no hamburger menu. Below md the header stacks into 2 rows (brand row, then a full-width row with the Dashboard dropdown + a horizontally scrolling pill row).

### 2.2 Dashboard menu — `lib/dashboard/menu.ts` (L1-17)
Shared by the Nav dropdown, `DashboardSubnav` and `/dashboard` page cards. ID only.
```
Kinerja Pariwisata:
  /dashboard/wisman        "Wisatawan Mancanegara"   sub "2024–2026 · tahunan & bulanan"
  /dashboard/wisnus        "Wisatawan Nusantara"     sub "kota tujuan · lama menginap"
Kinerja Ekonomi Kreatif:
  /dashboard/pdrb-ekraf    "PDRB Ekonomi Kreatif"    sub "2017–2025 · kontribusi vs target RPJMD"
  /dashboard/tenaga-kerja  "Tenaga Kerja Ekraf"      sub "jumlah · subsektor · tren"
```

### 2.3 `components/dashboard/DashboardSubnav.tsx` (L1-37) + `app/dashboard/layout.tsx` (L1-23)
**Layout:** `main.min-h-screen > div.mx-auto.max-w-[1320px].px-6.py-8`
- Eyebrow "Dashboard · Mandat RPJMD 2025–2029" (`apple-fine uppercase tracking-wider text-ink-muted-48`)
- h1 "Dashboard Statistik Pariwisata dan Ekonomi Kreatif" (`mt-1 text-[28px] font-bold tracking-tight text-ink`, wrapper `mb-5`)
- Then the subnav, then `div.mt-6` = children.

**Subnav:**
- `grid gap-3 md:grid-cols-2`; each group card `rounded-xl border border-hairline bg-white p-2 shadow-sm`.
- Group title: `px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted-48`.
- Items in `grid grid-cols-2 gap-1.5`, each `rounded-lg px-3 py-2`.
  - active: bg #ed6b23 + white text, sub `text-white/85`
  - inactive: `hover:bg-black/[0.04]`, label `text-[13.5px] font-semibold text-ink`, sub `text-[11px] text-ink-muted-48`
- Same active rule as the Nav.

### 2.4 `lib/data-sections.ts` (L1-12) — owner pages for dataset "sections"
```
gci         "Restoran GCI"          /gci/pariwisata/restoran-gci         GCI
restaurants "Direktori Restoran"    /gci/pariwisata/direktori-restoran   GCI
pertunjukan "Pertunjukan & Budaya"  /gci/pariwisata/pertunjukan-budaya   GCI
michelin    "Hotel MICHELIN Key"    /sdi/michelin-keys-indonesia         GCI
golf        "Lapangan Golf"         /gpci/lapangan-golf                  GPCI
souvenir    "Toko Suvenir"          /gpci/toko-suvenir                   GPCI
hotel       "Hotel & Akomodasi"     /gpci/hotel                          GPCI
```
Used by:
- `app/atlas/[section]/page.tsx` (redirect `/atlas/<key>` → href, or 404 for an unknown key)
- `app/katalog/hotel/page.tsx`
- `components/FrameworkDataLinks.tsx`, `lib/secondary.ts`, `lib/spatial.ts`

Other redirects: `app/atlas/page.tsx` → `/spatial`. The port should keep these legacy redirects (`/atlas`, `/atlas/:section`, `/katalog/hotel`).

### 2.5 `components/atlas/AtlasNav.tsx` (L1-60)
**`AtlasNav({view?, langToggle?, rightSlot?})`** (L12-33)
- Returns **null** unless `view` is set **and** a slot exists.
- Otherwise renders `border-b border-hairline bg-canvas > mx-auto max-w-[1320px] px-6 h-[52px] flex items-center gap-3 > ml-auto flex gap-2.5 [rightSlot][langToggle]`.

**`LangToggle({lang,onToggle,t})`** (L35-59)
- Pill `press-scale inline-flex items-center gap-1 rounded-full border border-hairline bg-canvas px-2.5 py-1.5 hover:border-ink-muted-48`.
- Content: `ID` (apple-caption-strong uppercase), `/` (apple-fine muted), `EN` (apple-fine muted). It displays `t("nav.switch_to")`.

**Where it actually renders:**
- Rendered: `components/Dashboard.tsx` L261 (`view="list"`, /gci/pariwisata/direktori-restoran), `SouvenirView.tsx` L340 (`view="list"` but no slot → renders nothing).
- Not rendered: `GciView`, `EventsView` and `GolfView` pass no `view`, so the toolbar and LangToggle are **not** rendered.
- `MapView.tsx` / `SouvenirMapView.tsx` pass `view="map"` but are **orphan files** (see §5).

---

## 3. i18n — `lib/i18n.ts` (L1-366)

**Mechanism:**
- No context, no cookie, no URL param. Exports `Lang="id"|"en"`, `DEFAULT_LANG="id"`, `STORAGE_KEY="dpj.lang"` (localStorage), `DICT={id,en}`, `translate(lang,key,vars)` (L354-366).
- `translate` falls back `DICT[lang][key] → DICT.en[key] → key`, and replaces `{var}` placeholders.
- Each consuming component keeps its own `useState<Lang>(DEFAULT_LANG)`, may read localStorage in `useEffect`, and its toggle writes localStorage. There is no cross-component sync.

**Dictionary size:** 143 keys per language (id L14-182, en L183-350). Namespaces and key counts:

| namespace | keys | namespace | keys |
|---|---|---|---|
| golf. | 27 | city. | 11 |
| home. | 21 | footer. | 11 |
| verify. | 16 | toolbar. | 10 |
| card. | 13 | nav. | 9 |
| hero. | 8 | list. | 5 |
| stat. | 4 | empty. | 2 |
| export. | 2 | map. | 2 |
| view. | 2 | | |

These strings are leftovers from the old "Jakarta Atlas / restaurant directory" project.

**Consumers:**

| component | reads localStorage | toggle visible |
|---|---|---|
| `Dashboard.tsx` (direktori restoran) | yes (L50-70; also `dpj.view` for card/rows) | **yes — the only visible toggle** |
| `GolfView.tsx` | yes (L91-109) | no |
| `GciView.tsx` | no — always ID | no |
| `EventsView.tsx` | no — always ID | no |
| `MapView.tsx` | — | orphan |

**Everything else is hard-coded Indonesian:** Nav, home, katalog, docs, dashboards, charts, GCI/GPCI/GMTI/Spatial, SdiTable. A few leftover English labels (e.g. MapView "All") sit in orphan code.

**Recommendation for the port:** ID-only, with an optional EN for the direktori-restoran page. If you keep EN, use a single `useState('dpj.lang')` composable; full `@nuxtjs/i18n` is not needed for parity.

---

## 4. Shared chart components (ECharts via `echarts-for-react`)

### 4.1 Common conventions
- Every wrapper renders `<ReactECharts option={...} style={{height}} notMerge lazyUpdate />`. Some also pass `opts={{renderer:"canvas"}}` (which is the default anyway).
- echarts-for-react auto-resizes on container resize. Use `<VChart autoresize>` in vue-echarts.
- **All options are plain objects with inline formatter functions → reusable verbatim in vue-echarts** (`:option` + `autoresize`). Only exceptions: `LineTrend` and `BarChart` use `new echarts.graphic.LinearGradient(...)`, so import `graphic` from `echarts` (or use the `{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[...]}` object form, which is identical).
- Each file has its own Indonesian number formatter: `const idfmt = (v:number) => v.toLocaleString("id-ID")`, so 1234567 → "1.234.567" and 51.85 → "51,85".
- **Axis colours** (shared literal hexes):
  - axis label `#94a3b8`
  - split line `#eef2f7`
  - axis line `#e2e8f0`
  - category label (BarBreakdown y) `#475569`
  - value labels `#334155`
  - legend text `#475569` at 11px, `icon:"circle"`
- Axis ticks are always hidden.
- **Empty state** (every chart): `<div class="text-[13px] text-slate-400 py-6 text-center">Tidak ada data.</div>`. LineTrend instead shows "Data tren belum cukup." when there are fewer than 2 points.
- Data type: `Point = {label:string; value:number}` (`lib/agg.ts` L14).

### 4.2 `components/charts/ChartExpand.tsx` (L1-184) — expand/fullscreen system
- `ChartExpandedContext` (React context, default false); `useChartExpanded()`.
  - Vue: `provide/inject('chartExpanded', false)`.
- `EXPANDED_HEIGHT = "min(68vh, 640px)"`; `ZOOM_PAD = 36`.
- `SLIDER_STYLE = { borderColor:"#e2e8f0", fillerColor:"rgba(237,107,35,0.15)", handleStyle:{color:"#ed6b23",borderColor:"#ed6b23"}, textStyle:{color:"#64748b",fontSize:10} }`.
- `categoryZoom(count, vertical=false, visible=14)` (L34-51): returns `[{type:"inside",…},{type:"slider",…}]`.
  - `end = count>visible ? max(5, visible/count*100) : 100`, with `filterMode:"none"`.
  - vertical → `orient:"vertical",width:16,right:4`; horizontal → `height:20,bottom:4`.
  - On screens narrower than 640px (horizontal only), `visible` is capped at 6.
- **`ExpandableChartCard({title, sub?, className?})`** (L57-184):
  - Card: `utility-card relative p-5 transition-shadow hover:shadow-md`.
  - Expand button at top-right: `absolute right-3 top-3 z-10 h-7 w-7 rounded-md text-ink-muted-48 hover:bg-black/5 hover:text-ink`, focus outline #ed6b23. Icon is a 15px SVG `M10 2h4v4M6 14H2v-4M14 2l-5 5M2 14l5-5`, `aria-label="Perbesar grafik"`.
  - Title block: `mb-3 border-l-2 pl-2.5 pr-8` with border colour #ed6b23; title `text-[14px] font-semibold text-ink`, sub `apple-fine text-ink-muted-48`.
  - **Modal** (portal to body):
    - overlay `fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-3 sm:p-6`; mousedown on the backdrop closes it
    - dialog `relative flex max-h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl`, height `min(92vh,860px)`
    - header `border-b border-black/10 px-5 py-4`, title 16px, close "✕" button 8×8
    - body `min-h-0 flex-1 overflow-auto p-5`
  - Re-renders the **same children** inside `Provider value=true`.
  - Behaviour while open: Esc closes; Tab focus is trapped; body scroll is locked; `window.dispatchEvent(new Event("resize"))` fires after 50ms; on close, focus returns to the trigger.
- **Expanded-mode behaviour (all charts):** taller (`EXPANDED_HEIGHT`), value labels shown, and dataZoom added where noted.

### 4.3 Chart wrappers

| Component (file, lines) | Props | Option summary |
|---|---|---|
| **BarBreakdown** `charts/BarBreakdown.tsx` L1-79 | `data:Point[], unit="", color="#ed6b23", colors?:string[]` (per-bar) | Horizontal bar. `grid{left:6,right:56(+36 if zoom),top:6,bottom:6,containLabel}`. Tooltip axis/shadow, `valueFormatter idfmt+unit`. xAxis value (label `#94a3b8`, idfmt, split `#eef2f7`, no line/tick). yAxis category `inverse:true`, label `#475569 width:150 overflow:"truncate"`. Series bar `barMaxWidth:22`, `itemStyle{color,borderRadius:[0,4,4,0]}`, **label always shown** right `#334155` 12px `idfmt+unit`. Height `max(160, n*34+20)`; expanded with >14 rows → EXPANDED_HEIGHT + vertical categoryZoom. |
| **VerticalBars** `charts/VerticalBars.tsx` L1-64 | `data, unit="", color="#ed6b23", labelFmt?, height=280` | `grid{6,16,top 16/28,bottom 24(+36)}`. Tooltip axis/shadow. xAxis label 11px `hideOverlap`. Bar `barMaxWidth:34`, radius `[4,4,0,0]`. Expanded: top label 11px + categoryZoom(n). |
| **GroupedBars** `charts/GroupedBars.tsx` L1-63 | `series:{name,data:Point[]}[], categories:string[], unit="", colors?, height=300, missingValue:0\|null=0` | `color: colors ?? ["#ed6b23","#f0a13a","#c2410c","#9a3412","#fb923c","#7c2d12"]`. `grid{top:30}`. Legend top circle. Bars `barMaxWidth:22` radius `[3,3,0,0]`. Values matched by label, missing → `missingValue`. Tooltip `v==null?"—":idfmt(v)+unit`. Expanded: labels 10px `hideOverlap` + categoryZoom(n,false,10). |
| **GroupedLines** `charts/GroupedLines.tsx` L1-65 | `series:{name,data}[]` | Palette `["#ed6b23","#f0a13a","#0e7c42","#b3261e","#7c3aed","#0891b2"]`. x = union of labels sorted with `localeCompare`. Lines `smooth`, circle symbol 5, `connectNulls`. Legend top 12px (no icon override). Height 300. Expanded: labels + categoryZoom(n,false,18). |
| **LineTrend** `charts/LineTrend.tsx` L1-84 | `data, unit="kunjungan", yName="Kunjungan"` | Single area line in #ed6b23, width 2.5, symbol 6, smooth. areaStyle LinearGradient `rgba(237,107,35,0.28)` → `rgba(237,107,35,0.02)`. xAxis name "Periode" (middle, gap 34), `boundaryGap:false`, label via `fmtPeriode`. yAxis name = yName. Tooltip `idfmt(v)+" "+unit`. Height 260. |
| **ComboBarLine** `charts/ComboBarLine.tsx` L1-91 | `categories, bar:{name,values,unit?}, line:{name,values,unit?}, dualAxis=true, height=320` | Bar #ed6b23 `barMaxWidth:40` radius `[4,4,0,0]`. Line **#0e7c42 dashed**, width 2.5, smooth, symbol 7, `connectNulls`. Dual y-axes (right axis label `${v}${line.unit}`, no split line, `alignTicks:false`). Tooltip axis/cross, null → "—". Legend top. `grid.top 36`. Expanded: labels (bar top `#334155`, or insideTop white when single-axis) + categoryZoom(n,false,12). |
| **Donut** `charts/Donut.tsx` L1-100 | `data, showPercent=false, colorMap?:Record<label,hex>` | `PALETTE=["#ed6b23","#f0a13a","#0e7c42","#2563eb","#7c3aed","#0891b2","#e11d48","#65a30d","#db2777","#0d9488"]`. Label matching `/^lainnya$/i` → `#cbd5e1`; `colorMap` wins over the palette. Pie radius `["52%","74%"]` (showPercent: `["44%","64%"]`), center `["50%","44%"]`, border white 2. Legend scroll bottom center circle 9×9 gap 12 text `#475569` 11. Tooltip `"{name}: {idfmt} ({percent}%)"`. Labels: hidden by default; with showPercent, outside `"x,y%"` 11px 600 `#33302b` and `minShowLabelAngle:7`; expanded shows `"name\nvalue (pct%)"` 12px. Height 288. |
| **Treemap** `charts/Treemap.tsx` L1-52 | `data, height=300` | Palette `["#ed6b23","#f0a13a","#c2410c","#f4a672","#9a3412","#fb923c","#b45309","#ea580c","#fdba74","#7c2d12"]` assigned per index. `roam:false`, `nodeClick:false`, no breadcrumb, white border 2 gap 2. Label `{b}` white 11 (expanded: name+value+pct 13). Tooltip `name<br/><b>v</b> (x.x%)`. |
| **KpiStat** `charts/KpiStat.tsx` L1-22 (server-safe) | `label, value:string\|number, sub?` | `bg-white rounded-xl border border-slate-200 shadow-sm p-5`. Label `text-[11px] font-mono uppercase tracking-wider text-slate-400`. Value `text-[30px] font-bold tabular-nums text-slate-900 mt-1` (numbers → `toLocaleString("id-ID")`). Sub `text-[12px] text-slate-500 mt-0.5`. |
| **RankedList** `charts/RankedList.tsx` L1-23 | `data, unit=""` | `<ol class="divide-y divide-slate-100">`, rows `flex gap-3 py-2 text-[13px]`: rank `w-6 text-right tabular-nums text-slate-400`, label `flex-1 truncate text-slate-700`, value `tabular-nums font-medium text-slate-900`. |
| **BarChart** `components/BarChart.tsx` L1-53 | `data:{label,value}[]` | Vertical bars, gradient top `#1b5aa8` (leftover navy blue!) → bottom `#ed6b23`. `barMaxWidth:28` radius `[4,4,0,0]`. x label via `fmtPeriode`. Height 240. Returns `null` when empty. Used only by `components/FrameworkView.tsx` and the AI feature. |
| **PointMap / PointMapClient** | see §5 | |

### 4.4 Dashboard kits

**`components/pariwisata/DashboardKit.tsx` (L1-97)** — used across /dashboard/*, GCI pariwisata pages and HotelView.
- `PALETTE = ["#ed6b23","#f0a13a","#c2410c","#f4a672","#9a3412","#fb923c"]`
- `KpiRow` = `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`
- `Kpi({label,value,sub,delta})` → KpiStat with sub `"▲ x,y% sub"` / `"▼ …"`. Note: the ▲/▼ is **not coloured** despite the comment saying so.
- `ChartCard` = `ExpandableChartCard`
- `ChartGrid({cols=3})` = `grid gap-4 md:grid-cols-2 [lg:grid-cols-3 when cols=3]`
- `RawDataDisclosure({slug,title,count,columns?,label="Lihat data mentah"})`:
  - `<details class="group rounded-xl border border-hairline bg-white/60">`
  - summary `cursor-pointer list-none px-5 py-3.5 text-[13px] font-semibold text-ink-muted-48 hover:text-ink`, with a "▸" that rotates 90° when open; text `"{label} · {title} ({count id-ID} baris)"`
  - body `border-t border-hairline p-5` containing `<SdiTable slug columns/>`

**`components/dashboard/Kit.tsx` (L1-51)** — /dashboard pages.
- `SectionHead({title,desc})`: `mb-3 mt-8 first:mt-0`, h2 `text-[18px] font-bold tracking-tight text-ink`, desc `apple-fine text-ink-muted-48`.
- `SourceNote`: `mt-6 apple-fine text-ink-muted-48`.
- `ModeToggle<T>({value,options,onChange})`:
  - container `inline-flex max-w-full flex-wrap rounded-xl border border-hairline bg-white p-1 shadow-sm`
  - button `whitespace-nowrap rounded-lg px-4 py-1.5 text-[13px] font-semibold`; active bg #ed6b23 white, inactive `text-ink-muted-48 hover:text-ink`; `aria-pressed`
- `BULAN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]`
- `idNum(v,d=0) = v.toLocaleString("id-ID",{maximumFractionDigits:d,minimumFractionDigits:d})`

### 4.5 Formatting helpers & palettes to centralise (`layers/shared/utils/format.ts`)

**Formatters:**
- `idfmt(v) = v.toLocaleString("id-ID")` — used by every chart.
- `idNum(v,d)` — `components/dashboard/Kit.tsx` L49.
- `idNum(n) = n.toLocaleString("id-ID")` — `lib/gmti.ts` L144 (name collision with the Kit version).
- **Parser** `idNum(v:unknown):number|null` — `lib/agg.ts` L4-11. It parses Indonesian numerals: `"51,85"`→51.85, `"1.234.567"`→1234567. Rule: if the string contains `,` and has no `.\d` → strip dots, then comma→dot; otherwise strip commas.
- `fmtPeriode("201801")` → `"Jan 2018"` (`lib/agg.ts` L50-59); other values pass through.
- `lib/agg.ts` also has `groupSum`, `groupCount`, `byPeriod`, `topN`, `total` (pure, port 1:1).

**Palettes:**
- Brand: orange `#ed6b23`, deep `#c9531a`, soft `#f4a06b`, gold `#f0a13a`, civic green `#0e7c42`, link `#2563eb`.
- Subsector colours — `lib/dashboard/subsektor-colors.ts` L1-49:
  - `WARNA` = 16 subsektor ekraf → hex (aplikasi `#2563eb`, arsitektur `#64748b`, desain interior `#0891b2`, DKV `#7c3aed`, desain produk `#db2777`, fashion `#e11d48`, film `#f0a13a`, fotografi `#0d9488`, kriya `#a16207`, kuliner `#ed6b23`, musik `#9333ea`, penerbitan `#65a30d`, periklanan `#0e7c42`, seni pertunjukan `#c2410c`, seni rupa `#4f46e5`, TV & radio `#0369a1`)
  - plus `ALIAS` map, `norm()` and fallback `#94a3b8`; `warnaSubsektor(nama)`. Port verbatim.
- Spatial categories — `lib/spatial.ts` L10-23 (`SPATIAL_CATEGORIES`, with SVG icon path strings):

  | key | label | colour |
  |---|---|---|
  | gci | Restoran GCI | `#ed6b23` |
  | restaurants | Direktori Restoran | `#b45309` |
  | golf | Lapangan Golf | `#15803d` |
  | souvenir | Toko Suvenir | `#a16207` |
  | budaya | Budaya | `#7c3aed` |
  | hotel | Hotel | `#0369a1` |
  | wisata | Destinasi lainnya | `#0891b2` |

  GMTI pillars come from `lib/gmti.ts` L23-45:

  | pillar | label | colour |
  |---|---|---|
  | ibadah | Ibadah | `#0f7b6c` |
  | makan | Makan & minum | `#ed6b23` |
  | menginap | Menginap | `#7048b6` |
  | destinasi | Destinasi & fasilitas | `#1e6bb8` |
  | program | Program dan Event | `#c2185b` |

---

## 5. Map components (Leaflet)

### 5.1 Basemap — `lib/basemap.ts` (L1-61)
- Esri **World Light Gray Canvas**, no API key. CARTO was rejected because it now stamps tiles "API KEY REQUIRED".
- `addBasemap(map)` adds two layers:
  - base: `https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`
  - labels: `…/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}` in `pane:"shadowPane"`, so labels sit above the choropleth
- Both layers use `maxNativeZoom:16, maxZoom:18`.
- Attribution: `'Peta © <a href="https://www.esri.com">Esri</a> — sumber: Esri, HERE, Garmin, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'`.
- ⚠ A government server may need outbound access to `services.arcgisonline.com`, plus `unpkg.com` for marker icons — **belum terverifikasi** for the new environment. Consider bundling the Leaflet marker images locally.

### 5.2 Default-icon patch (repeated in every map file)
```js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({iconRetinaUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png", iconUrl:".../marker-icon.png", shadowUrl:".../marker-shadow.png"});
```

### 5.3 SSR trick
Leaflet needs `window`, so:
- pages wrap views with `next/dynamic(..., {ssr:false, loading: () => <main className="min-h-screen bg-paper px-6 py-8"><p role="status">Memuat …</p></main>})` (e.g. `app/spatial/page.tsx` L5-8: "Memuat peta Spatial…")
- `PointMapClient` and `VenueMapClient` are dynamic wrappers.

Nuxt equivalent: `<ClientOnly>` with a `#fallback`, or `.client.vue` components; import leaflet inside `onMounted`.

### 5.4 Components

**`GmtiMapView`** — `components/GmtiMapView.tsx` L1-542. This is the **/spatial page** and the main shared map. Imperative Leaflet + markercluster.
- Root: `<main class="flex flex-col overflow-hidden bg-paper" style="height:calc(100dvh - 78px)">`. A ResizeObserver then recomputes the height to fit the viewport minus the header (L193-213).
- Data sources:
  - static `SPATIAL_POINTS` (`lib/spatial.ts` L52-59, built from in-code GCI restaurants, restaurants, golf, souvenir, seni venues JSON, GMTI places)
  - `GET /api/spatial` (lakehouse silver tables with lat/lng + `serving.mart_hotel_scraped_booking`)
  - `/gmti-ibadah.json`
  - `/geo/dki-jakarta.geojson`
  - Points are de-duplicated by `category|name|lat|lng`.
- **Choropleth:** density of active-category points per kecamatan.
  - Point-in-polygon is ray casting + bbox (L55-83). Ibadah rows without coordinates are counted via their `kecamatan` field.
  - Ramp `["#e8f2f0","#c3ded9","#93c5bc","#5aa79b","#2d8b7c","#0f7b6c"]`, quantile breaks; no data → `#f1f3f5`.
  - Style: fillOpacity .72, stroke #fff weight 1.2.
  - Popup lists the per-category counts.
- **Pins:** markercluster with `{chunkedLoading, chunkInterval:20, chunkDelay:16, maxClusterRadius:46, spiderfyOnMaxZoom, showCoverageOnHover:false}`.
  - Markers are added in batches of 150 every 16ms and cached by id.
  - `divIcon` is a 28px circle in the category colour, 2.5px white border, shadow `0 3px 10px rgba(15,20,25,.35)`, 20px white stroke SVG icon inside.
  - Popup HTML (L103-115): category label in colour, name 14px 600, kind, address, source, cert, links "Lihat dataset →" and "Buka di Maps ↗" (#0b62d1).
- **UI:**
  - A collapsible `<details class="frosted">` filter strip with summary "Filter peta · N titik".
  - Buttons: choropleth toggle "Kepadatan kecamatan" (active `bg-ink text-white`); combined chips "Hotel" (hotel+menginap) and "Ramah Muslim" (5 GMTI pillars); one chip per category coloured when active.
  - Counter "x / y titik"; search input (debounce 180ms) "Cari nama, alamat, atau wilayah…"; wilayah select "Semua wilayah"; "Reset filter".
  - Legend `<details>` at bottom-left: "Legenda & sumber", the ramp, a per-category dot list, and a note.
  - Loading/error lines: "Memuat seluruh sumber berkoordinat…", plus an error with a "Coba lagi" retry.
  - Init: `center [-6.2,106.82]`, zoom 11; fitBounds when a search/city filter is active (maxZoom 14).

**`VenueMap` + `VenueMapClient`** — `components/pariwisata/VenueMap.tsx` L1-224, `VenueMapClient.tsx` L1-18. Used on `/gci/pariwisata/seni-pertunjukan`. Declarative react-leaflet.
- Same Esri layers as `<TileLayer>`; `center [-6.2,106.85]` z11, `preferCanvas`; FitBounds padding 30 maxZoom 13.
- CircleMarkers:
  - normal venues: orange `#ed6b23`, radius `4+9*count/max`, white stroke
  - "gold" venues: `#e6a900` fill, dark `#8a6a00` stroke, radius 9, plus an 18px halo at 0.22 opacity
  - selected: `#1d1d1f` stroke, weight 3
- Layout: map left (`h-[380px] md:h-[520px] rounded-2xl`) + right panel `md:w-[340px]` with a Google Maps iframe embed (`maps.google.com/maps?q=lat,lon&z=16&output=embed`, h170), venue info and events list.
- Legend at bottom-right.
- Loading placeholder: "Memuat peta venue…" (h-460). Empty state: "Belum ada venue dengan koordinat."

**`PointMap` + `PointMapClient`** — `components/charts/PointMap.tsx` L1-85, `PointMapClient.tsx` L1-20. Used by indicator components `CiTa`, `CiMu`, `Ce4`, `CiWh`.
- ⚠ Tiles are **OSM standard** `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, not Esri.
- CircleMarker #ed6b23 fill .5, radius `4+14*v/max`; popup `"<b>label</b><br>N kunjungan"`.
- Container `rounded-xl overflow-hidden border border-slate-200 h-[420px]`; FitBounds maxZoom 13.
- Empty state: "Tidak ada titik dengan koordinat valid." Loading: "Memuat peta…".

**Orphans (no importer — do not port):**
- `components/MapView.tsx` (L1-324, old restaurant cluster map; links `/map`, `/golf`)
- `components/SouvenirMapView.tsx` (L1-292; its comment refers to `/atlas/souvenir/map`, which no longer exists)
- `components/atlas/CompassRose.tsx` (L1-131, decorative SVG)
- `GolfView` has its own inline Leaflet map using `addBasemap` (other agent's scope).

---

## 6. Other shared pieces

### 6.1 Export — `components/atlas/ExportButton.tsx` (L1-152) + `lib/export.ts` (L1-100)
Used by Dashboard (direktori restoran), GciView, EventsView, GolfView, SouvenirView, GmtiView and HotelView.

**ExportButton** `({onExport(format), label, disabled})`:
- Pill `press-scale inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 apple-caption-strong text-ink-muted-80 hover:text-[color:var(--accent)] hover:border-[color:var(--accent)] disabled:opacity-50`.
- Download icon (spinner while busy) + label + chevron that rotates when open.
- Menu `absolute right-0 top-full mt-1.5 min-w-[156px] rounded-lg border border-hairline bg-canvas shadow-[0_8px_24px_rgba(15,23,42,0.10),0_2px_6px_rgba(15,23,42,0.05)] py-1 z-50`.
- Items CSV/.csv, XLS/.xls, XLSX/.xlsx; hint in `atlas-mono text-[10px]`.
- Closes on outside click or Esc.

**lib/export.ts:**
- `toCsv(rows, columns:{header, value(row,i)}[])`: RFC-style quoting, CRLF, **UTF-8 BOM** prefix.
- `downloadCsv` uses a Blob plus a temporary `<a download>`.
- `dateStamp()` → `YYYY-MM-DD`.
- `downloadSpreadsheet(base, rows, columns, format, sheetName="Sheet1")`: csv is native; xls/xlsx lazy-import `xlsx`, use `aoa_to_sheet`, auto column widths `wch = clamp(maxLen+2, 8, 50)`, then `writeFile(..., {bookType:format})`.
- (Minor bug: the width loop passes the column index as the row index. It is harmless.)
- Port verbatim to a composable (`xlsx` works the same in Vue).
- The server-side export endpoint `/api/sdi/{slug}/export` is separate (other agent).

### 6.2 `components/SdiTable.tsx` (L1-238)
Embeddable lake-backed table, used via `RawDataDisclosure`.
- **Fetch:** `GET /api/sdi/{slug}?offset&limit=50&q`. Response `{columns:[{key,desc,type}], rows, total, count, error?}`.
- **Search:** input debounce 350ms. Input `w-full max-w-sm rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[14px] focus:border-[#ed6b23]`, placeholder "Cari di dalam data…". Counter "x / y baris (hasil pencarian)".
- **Infinite scroll:** IntersectionObserver with rootMargin 600px.
- **Columns:** hidden keys `id,user_id,uid_upload,batch_upload,jadwal_rilis,tanggal_upload,tanggal_update,created_at,updated_at`; `humanize` = underscores → spaces + Title Case. The optional `columns` prop orders/limits them.
- **Cell formatting:** empty → "—"; pure digit strings of ≥5 chars → id-ID grouped.
- **Table:**
  - wrapper `overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm`
  - header row `background:#ed6b23` + `text-left text-[12px] uppercase tracking-wider text-white`, th `px-4 py-3 font-semibold`, first column "#"
  - rows `border-t border-slate-100 hover:bg-slate-50`, td `px-4 py-3 tabular-nums text-slate-700`
- **States:** "Memuat data…" / "Tidak ada baris data." / "Memuat baris berikutnya…" / "Gulir untuk memuat lebih banyak".
- **Error:** red box `rounded-xl border border-red-200 bg-white p-8 text-center text-red-600` with "{error}. Coba buka di portal SDI ↗".
- **Footer note:** "Menampilkan x dari y baris · Sumber: Satu Data Indonesia — Jakarta · lihat di portal ↗" (link `https://satudata.jakarta.go.id/open-data/{slug}`).

### 6.3 `components/CatalogView.tsx` (L1-487) — see §7.2

### 6.4 AI (OUT OF SCOPE — remove)
- Mounted globally in `app/layout.tsx` L4 & L38 (`<AiDock/>`, a floating button bottom-right; CSS in `features/ai/ai.css`, 1322 lines).
- Also the page `app/ai/page.tsx` and the Nav item `{href:"/ai",label:"AI"}` (Nav.tsx L19).
- API routes `app/api/ai/ask`, `app/api/ai/text-to-sql`; libs `lib/ai/*`.
- **`platform-v2/features/`** contains only `features/ai/`: ai-composer, ai-dock, ai-messages, ai-mini-markdown, ai-page, ai-tool-step, chart-view, generative-ui, use-ai.ts, ai.css. It is the self-contained AI chat feature (provider + dock + full page, lucide-react icons). Nothing else lives in `features/`. Drop it entirely; `BarChart.tsx` is also used by `FrameworkView`, so keep that.

---

## 7. Pages in scope

### 7.1 Home `/` — `app/page.tsx` (L1-215)
- Server component, fully static: no DB/lake calls.
- **Data sources:**
  - `sdiStats()` from `lib/sdi.ts` over the `lib/sdi-data.json` snapshot (**182** datasets)
  - `secondaryDatasets()` from `lib/secondary.ts` L23-454: **43** entries; Σrows = 19 241 (literals) + 67 (`SOUVENIR_SHOPS.length`) + 120 (`HOTEL_META.totals.hotels`) = **19 428**
  - `INDICATORS` = `data/gci-gpci-indicators.json`: 28 total = **GCI 8 + GPCI 20**
- These are what the code computes at HEAD, not checked against the live site.

**Hero** (`relative overflow-hidden text-white`):
- Background: `radial-gradient(1100px 420px at 88% -12%, rgba(240,161,58,0.14), transparent 60%), radial-gradient(760px 460px at 6% 118%, rgba(237,107,35,0.22), transparent 62%), linear-gradient(160deg, #2a2521 0%, #16130f 100%)`.
- Dot-grid overlay: `radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)` size 22px, opacity .5, mask `linear-gradient(180deg, rgba(0,0,0,.9), transparent 78%)`.
- Content `relative mx-auto max-w-[1320px] px-6 pt-16 pb-12`:
  - Chip `inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 atlas-mono text-white/75 backdrop-blur`: gold "●" + "Dashboard Visualisasi Data Terkonsolidasi".
  - h1 `mt-5 atlas-display max-w-[18ch] text-white`: "Data Pariwisata **<span class=atlas-italic gold>& Ekonomi Kreatif</span>** Jakarta".
  - Lead `mt-5 apple-lead max-w-[64ch] text-white/75`: "Empat pintu masuk ke data Dispar — katalog SDI, kesiapan indikator GCI/GPCI, dan pendataan lapangan. Pilih menu untuk membuka visualisasi."
  - Stats strip `mt-9 grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/12 bg-white/5 backdrop-blur`. Cells `bg-white/[0.03] px-5 py-4`, value `text-[26px] md:text-[30px] font-bold tabular tracking-tight leading-none` white, label `mt-1.5 apple-fine text-white/60`. Values:

    | value | label |
    |---|---|
    | 182 | Dataset primer SDI |
    | 19.428 | Baris pendataan lapangan |
    | 28 | Indikator GCI · GPCI dipantau |
    | 2 | Indeks global (GCI · GPCI) |

- Bottom: 3px gold hairline `linear-gradient(90deg, transparent, #f0a13a, transparent)` at opacity .7.

**Menu cards** (`mx-auto max-w-[1320px] px-6 py-11 pb-20`):
- Header row: "Pilih menu" (`atlas-mono text-ink-muted-48`) and "4 modul" (`apple-fine`).
- Grid `sm:grid-cols-2 lg:grid-cols-4 gap-5`.
- Each card `group utility-card press-scale flex flex-col p-6 hover:-translate-y-1`:
  - Top row: number "01".."04" (atlas-mono) + icon tile `h-11 w-11 rounded-xl bg-primary/10` with orange 22px stroke-1.7 SVG. The intended `group-hover:bg-primary` likely does nothing (see §1.3 caveat; **belum terverifikasi** visually).
  - Title `atlas-display-md`; GCI also gets a badge "Prioritas" (`text-[9px] font-bold uppercase tracking-wider text-white bg-[#ed6b23] rounded px-1.5 py-0.5`).
  - Desc `mt-2 apple-caption min-h-[42px] text-ink-muted-48`.
  - Footer `mt-5 border-t border-hairline pt-4`: stat (`apple-caption-strong text-ink-muted-80`) + orange "→" that shifts `translate-x-1` on hover.
- Cards:

  | # | route | title | desc | stat |
  |---|---|---|---|---|
  | 01 | /katalog | Katalog Data | Data primer Satu Data Jakarta + dataset sekunder pendataan lapangan. | "182 + 43 dataset" |
  | 02 | /gci | GCI | Kearney Global Cities Index — prioritas indikator competitiveness. | "8 indikator" |
  | 03 | /gpci | GPCI | Mori Global Power City Index — kesiapan indikator pariwisata. | "20 indikator" |
  | 04 | /spatial | Spatial | Peta pariwisata Jakarta — data GCI, GPCI, dan GMTI dengan filter kategori. | "19.428 baris" |

- Icon SVG paths (`ICONS` L13-39):
  - katalog: 3 rects `x3 y4/10/16 w18 h4 rx1`
  - gci: globe (`circle r9` + meridian path)
  - gpci: buildings `M4 21V7l6-3v17M14 21V9l6 3v9` + dots
  - spatial: folded map `M9 3 4 5v16l5-2 6 2 5-2V3l-5 2-6-2z` + `M9 3v16M15 5v16`

### 7.2 `/katalog` — `app/katalog/page.tsx` → `<CatalogView/>`
`/sdi` reuses it as `<CatalogView primaryOnly/>` (`app/sdi/page.tsx`).

**Data:**
- Seed: the static `SDI_DATASETS` (182), replaced by `GET /api/sdi`, which returns `{source:"lakehouse",count,datasets:SdiDataset[]}` from `lake.bronze_meta.dataset_catalog` UNION `bronze_meta_sec`, filtered `tier="primer"`, sorted by updatedAt desc (`lib/ch/store.ts` `catalog()` L28).
- Secondary rows from the static `secondaryDatasets()`.
- Medallion: `GET /api/sdi/medallion` → `{counts,datasets:{[slug|secId]:{level,mart?}}}`.
  - Computed in `store.medallion()`: gold if the source table feeds a `serving.mart_*` in `GOLD_SOURCES` (L157-170), silver if `silver.<table>` exists, else bronze.
  - Plus `ATLAS_TABLES` `{sec-gci-resto:atlas_restoran, sec-events:atlas_pertunjukan}`.
  - Uses `SHOW TABLES FROM silver/serving`.

**Title band:**
- `style=background:HERO` (same as `--hero`), `text-white`, `mx-auto max-w-[1320px] px-6 pt-8 pb-12`.
- Eyebrow `text-[12px] font-mono uppercase tracking-widest text-white/60`: gold ● + "Katalog Data Terkonsolidasi" (or "SDI · Satu Data Jakarta").
- h1 `mt-3 text-[30px] md:text-[38px] font-bold tracking-tight max-w-[22ch]`: "Katalog Data" (or "Satu Data Jakarta").
- Lead `mt-3 text-white/75 max-w-[72ch] text-[15px]`.
- Stats `mt-7 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-[720px]`. Each Stat card is `rounded-lg bg-white/10 border border-white/15 px-4 py-3`, label `text-[11px] font-mono tracking-wider text-white/60` with an optional dot, value `text-[22px] font-bold tabular-nums mt-1`. Stats:
  - "DATA PRIMER (SDI)" = count (gold dot)
  - "DATA SEKUNDER" = 43 (green #0e7c42 dot; hidden in primaryOnly)
  - "TOPIK / TAG" = distinct lowercased tags
  - "TOTAL DILIHAT" = Σviews (id-ID)

**Toolbar** (overlaps the hero: `-mt-6 relative z-10`):
- Card `bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col lg:flex-row lg:items-center gap-3`.
- Search: `flex-1 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-[14px] focus:border-[#ed6b23] focus:bg-white`, placeholder "Cari dataset, deskripsi, sumber, atau tag…".
- Two segmented controls (`bg-slate-100 rounded-lg p-1`; buttons `px-3 py-1.5 rounded-md text-[13px] font-medium`; active orange/white, inactive `#475569`):
  - tier: Semua / Primer / Sekunder (hidden in primaryOnly)
  - medallion: Semua lapisan / Bronze n / Silver n / Gold n (title tooltip = note)
- "{n} baris" + badge "◆ LAKEHOUSE" (`text-[11px] px-2 py-1 rounded-full bg:#eef2f9 color:#ed6b23`).

**Table:**
- Same orange-header pattern as SdiTable.
- Columns: `#` | Nama Dataset (+ TierBadge, description `line-clamp-2 max-w-[60ch]`) | Tag (`hidden md:table-cell`, first 4 tags as `text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600`) | Lapisan (MedalBadge) | Sumber | Ukuran (`hidden sm:table-cell`, "N dilihat" / "N baris") | Aksi ("Lihat data →" internal, "Lihat data ↗" external; colour #2563eb).
- Empty: "Tidak ada dataset yang cocok."

**Badges:**
- TierBadge `text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded`:
  - primer: bg `#eef2f9`, fg `#ed6b23`, "Data Primer"
  - sekunder: bg `#e8f5ee`, fg `#0e7c42`, "Data Sekunder"
- MedalBadge "◆ Bronze/Silver/Gold":
  - bronze bg `#f6ebe1` fg `#8a5223`
  - silver `#eef1f5` / `#4a5a6b`
  - gold `#fbf0d6` / `#8a6a12`
  - none → "—" `text-slate-300`

**Below the table:**
- Legend line.
- Medallion explainer card (`rounded-xl border border-slate-200 bg-white p-5`, 3-column grid with per-layer text).
- "Dataset yang belum tersalin ke lakehouse tidak diberi label lapisan."
- Source row: "Pendataan Jakarta" for external secondary entries, otherwise "Dinas Pariwisata & Ekraf DKI Jakarta"; primer rows show "SDI · Satu Data Jakarta".

### 7.3 `/katalog/hotel` — `app/katalog/hotel/page.tsx`
Server `redirect(DATA_SECTIONS.hotel.href)` → `/gpci/hotel`. No UI.

### 7.4 `/docs` — `app/docs/page.tsx` + `docs-client.tsx` (L1-676)
Static client page, no data fetch.

**Hero** `bg-hero text-white`, `mx-auto max-w-[1320px] px-6 pt-14 pb-16`:
- Eyebrow `atlas-mono` (colour accent-soft): "Dokumentasi · REST API · v1".
- h1 `atlas-display max-w-[720px]`: "API Data Pariwisata *& Ekonomi Kreatif*" (italic accent-soft).
- `atlas-lead` text at white/.72.
- Base URL chip (`rgba(255,255,255,.07)` + border `.14`; "Base URL" label `#8d8172`; code `#f0e9df`) with a CopyButton showing `https://dispar.rantai.dev`.
- Three pills (`bg rgba(237,107,35,.16)`, border `.35`, color `#f7c39e`): "5 endpoint", "JSON", "Baca publik tanpa autentikasi".

**Body** `lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12`:
- **Sidebar:** sticky `lg:top-[98px]`, scroll-spy (IntersectionObserver rootMargin `-96px 0px -55% 0px`).
  - Active link: bg accent-bg, colour accent-deep, weight 600.
  - Small MethodBadges; "Jelajahi katalog →" links to `/sdi`.
- **Sections** (`scroll-mt-[98px]`, `space-y-14`):
  1. Pengantar
  2. GET `/api/sdi` Katalog dataset
  3. GET `/api/sdi/{slug}` Detail & baris data
  4. GET `/api/sdi/{slug}/export`
  5. POST `/api/admin/sync`
  6. GET(+POST alt) `/api/admin/report`
  7. Kode status (200/400/401/404/500/502)
  8. Small footer: "Dinas Pariwisata & Ekonomi Kreatif Provinsi DKI Jakarta · Sumber data: Satu Data Indonesia — Jakarta"

**Components:**
- MethodBadge:
  - GET: bg `rgba(22,128,90,.1)`, text `#0f7a54`, border `rgba(22,128,90,.25)`
  - POST: accent-bg / accent-deep / accent-ring
- CodeBlock: bg `#1f1a15`, border `#2e2721`, text `#e8e0d4`, label `#8d8172`, 12.5px/1.7 mono, with a CopyButton ("Salin"/"Tersalin", `#a89c8d`/`#7fd6ab`).
- Hand-written regex highlighters `hlJson`/`hlShell`/`hlHttp` with token colours: key `#f4a06b`, str `#d9c98f`, num `#8fd3b6`, cmd `#f4a06b` 600, flag `#b8ab99`, url `#9fc4e8`.
- ParamTable (columns Parameter/Letak/Tipe/Keterangan; "wajib" in accent-deep).
- Error rows: code chip `rgba(190,40,40,.08)` / `#b03030`.
- "Coba di browser ↗" button (accent background, white).

⚠ **Content is stale vs the code.** It describes `source: db|snapshot|live`, a `?live=1` param and "fetch live ke SDI", but the current routes return `source:"lakehouse"`, never call SDI, and return 404/503. For the port the docs must describe the **new Laravel API**: rewrite the ENDPOINTS array and keep the visual design.

---

## 8. Global UX patterns
- **Container:** `mx-auto max-w-[1320px] px-6` almost everywhere. Atlas-origin views (MapView, Souvenir, Gmti filter strips) use `max-w-[1280px]`.
- **Page background:** `bg-paper` `#faf6f2`; some pages use the literal `bg-[#faf6f2]`.
- **Dark hero header pattern** (Home, Katalog/SDI, Docs, PariwisataShell, GCI pages):
  - Background `--hero` (radial orange glow at top-right over a charcoal `#2a2521 → #16130f` linear gradient).
  - Eyebrow: mono uppercase white/60 with a gold `●`.
  - White bold h1 (`atlas-display` or 30/38px).
  - Lead at white/75.
  - Stat chips `bg-white/10 border-white/15 rounded-lg`.
- `PariwisataShell` (`components/pariwisata/PariwisataShell.tsx` L1-131) adds:
  - breadcrumb "← GCI · Pengalaman Budaya"
  - meta "Tahun/Sumber" (link `#8ab4ff`, value gold)
  - a headline indicator box at the right (`rounded-2xl border-white/12 bg-white/[0.05] px-6 py-5`, number 46px bold)
  - its `Section` component: h2 `atlas-display-md`, desc `apple-caption text-ink-muted-48 max-w-[80ch]`
- **Light page header** (Dashboard): eyebrow `apple-fine uppercase tracking-wider text-ink-muted-48` + h1 28px bold.
- **Cards:**
  - `.utility-card` (radius 12, hairline, soft shadow, orange-tinted hover border)
  - "slate" cards `bg-white rounded-xl border border-slate-200 shadow-sm` (KpiStat, tables, toolbar)
  - Chart cards: utility-card + p-5 + orange left-border title
- **Buttons / chips:**
  - Nav pills `rounded-lg px-3.5 py-2`, active orange
  - Segmented controls `bg-slate-100 rounded-lg p-1` or `ModeToggle` (white rounded-xl)
  - Atlas pills `rounded-full border-hairline press-scale`
- **Tables:** orange header row with white uppercase 12px tracking-wider text, `#` index column, `border-t border-slate-100 hover:bg-slate-50` rows.
- **Links:** blue `#2563eb` (`--link`) inside light content; light blue `#8ab4ff` on dark heroes; popups use `#0b62d1`/`#0066cc`.
- **Spacing:** sections `py-8` to `py-12`, `pb-20` at page end, grid gaps `gap-4`/`gap-5`.
- **Loading states:** plain text with `role="status"`: "Memuat data…", "Memuat peta Spatial…", "Memuat kesiapan data GCI…", "Memuat…" (GMTI). Tables say "Memuat data…". There are **no skeletons, spinners (except ExportButton), or `loading.tsx`/`error.tsx`/`not-found.tsx` files.** Next's default 404 page is used.
- **Empty states:** `text-[13px] text-slate-400 py-6 text-center` ("Tidak ada data.").
- **Error states:** red bordered box (SdiTable); inline `role="alert"` + "Coba lagi" underline button (Spatial).
- **Footer:** **no global footer.** Only per-view footers: `GciView` L374, `EventsView` L318, `GolfView` L381, `Dashboard` L446, `HotelView` L305, `SouvenirView` L567, docs.
  - Typical form: `border-t border-hairline bg-paper > max-w-[1320px] px-6 py-5 atlas-fine text-ink-muted-48 flex justify-between` with "Sumber: …".
- **Breakpoints:** Tailwind defaults; key switches happen at `sm` (brand text, back-label), `md` (header row, grid 2/4 columns) and `lg` (grid 3/4 columns, docs sidebar).
- **Dark mode:** no.
- **Motion:** `press-scale` (scale .97), 180ms transitions, `hover:-translate-y-1` on home cards.

---

## 9. `docs/DESIGN.md` (`/home/uaa/Dinas-Pariwisata/docs/DESIGN.md`, 562 lines)
- A generic **"Apple-inspired"** design spec in YAML front-matter + prose:
  - single Action Blue `#0066cc` accent; ink `#1d1d1f`; parchment `#f5f5f7`; hairline `#e0e0e0`
  - SF Pro Display/Text (Inter fallback); type scale (hero 56/600, display-lg 40, body 17px/1.47, caption 14, fine 12)
  - radii xs5/sm8/md11/lg18/pill; 8px spacing base, section padding 80px
  - "no decorative gradients, no card shadows, only one product shadow"
  - black 44px global nav + 52px frosted sub-nav; `scale(0.95)` press state; breakpoints table
- **It does NOT describe the current app.** The live theme replaced blue with Dispar orange `#ed6b23`, uses the Plus Jakarta Sans font and warm paper `#faf6f2`, and uses gradients/heroes and card shadows freely. Only its vocabulary survives in class names (`apple-*`, `frosted`, `utility-card`, `rounded-apple_lg` = 18px, the 52px AtlasNav toolbar, `press-scale`).
- **For the port, treat `globals.css` + Tailwind config + the component classes above as the source of truth, not DESIGN.md.**

---

## Shared building blocks the Nuxt `layers/shared` must provide

| Nuxt component / module | Source file(s) | Notes |
|---|---|---|
| `assets/css/globals.css` | `app/globals.css` L1-238 | Copy verbatim (CSS vars, base, `.atlas-*`/`.apple-*` type classes, `.utility-card`, `.frosted`, `.press-scale`, hand-written utilities, Leaflet overrides). Keep the utilities as plain CSS (no hover variants). |
| `tailwind.config` | `tailwind.config.ts` | Same `colors` (navy=orange alias, orange, gold, civic) + `fontFamily.sans var(--font-sans)`; default breakpoints. |
| Font | `app/layout.tsx` L2-11 | Plus Jakarta Sans variable font, exposed as `--font-sans` on `<html>`, `display:swap`. |
| `app.vue` / `layouts/default.vue` | `app/layout.tsx` | `<AppNav/>` + `<NuxtPage/>`; **no AiDock**; `lang="id"`; head meta/favicons/manifest (fix stale manifest colours optionally). |
| `public/` | `platform-v2/public/*` | logo-jakarta.png, favicons, webmanifest, `geo/dki-jakarta.geojson`, `gmti-ibadah.json` (or serve the latter from the Laravel API). |
| `AppNav.vue` | `components/Nav.tsx` | Sticky header, 3px orange strip, back button (`router.back()`, hidden on `/`), logo + 2-line brand, CSS-hover Dashboard dropdown, horizontally scrolling pill nav; active = exact or prefix match; drop the "AI" item. |
| `dashboardMenu.ts` | `lib/dashboard/menu.ts` | Shared by AppNav, DashboardSubnav and the /dashboard cards. |
| `DashboardSubnav.vue` + `layouts/dashboard.vue` | `components/dashboard/DashboardSubnav.tsx`, `app/dashboard/layout.tsx` | Eyebrow + h1 + 2-group pill grid. |
| `dataSections.ts` + redirect route rules | `lib/data-sections.ts`, `app/atlas/**`, `app/katalog/hotel` | `/atlas` → `/spatial`; `/atlas/:section` → section href; `/katalog/hotel` → `/gpci/hotel`. |
| `AtlasToolbar.vue`, `LangToggle.vue`, `useLang()` | `components/atlas/AtlasNav.tsx`, `lib/i18n.ts` | Only needed for direktori-restoran (the only visible toggle); localStorage key `dpj.lang`; 143-key dict id/en with `{var}` interpolation. |
| `utils/format.ts` | `lib/agg.ts`, `components/dashboard/Kit.tsx` L48-49, `lib/gmti.ts` L144 | `idfmt`, `idNum(v,d)`, parser `parseIdNum`, `fmtPeriode`, `BULAN`, `groupSum/groupCount/byPeriod/topN/total`. |
| `utils/palettes.ts` | chart files, `DashboardKit.tsx` L6, `lib/dashboard/subsektor-colors.ts`, `lib/spatial.ts` L10-23, `lib/gmti.ts` L23-45 | Orange ramp palettes, Donut 10-colour palette + `#cbd5e1` "Lainnya", GroupedLines palette, `warnaSubsektor()`, spatial category + GMTI pillar colours/labels/icons. |
| `ChartCard.vue` (= ExpandableChartCard) + `chartExpanded` provide/inject + `categoryZoom()`, `EXPANDED_HEIGHT`, `ZOOM_PAD` | `components/charts/ChartExpand.tsx` | Teleport modal; Esc / focus trap / scroll lock / resize dispatch; children re-rendered with expanded=true. |
| `BarBreakdown.vue`, `VerticalBars.vue`, `GroupedBars.vue`, `GroupedLines.vue`, `LineTrend.vue`, `ComboBarLine.vue`, `Donut.vue`, `Treemap.vue`, `BarChart.vue` | `components/charts/*.tsx`, `components/BarChart.tsx` | vue-echarts `<VChart :option autoresize>`; options reusable verbatim (import `graphic` for LinearGradient); identical heights and empty-state text. |
| `KpiStat.vue`, `RankedList.vue` | `components/charts/KpiStat.tsx`, `RankedList.tsx` | Pure markup. |
| `DashboardKit` (`KpiRow`, `Kpi`, `ChartGrid`, `RawDataDisclosure`) | `components/pariwisata/DashboardKit.tsx` | `Kpi` delta → ▲/▼ text (uncoloured). |
| `Kit` (`SectionHead`, `SourceNote`, `ModeToggle`) | `components/dashboard/Kit.tsx` | |
| `PariwisataShell.vue`, `PageSection.vue` | `components/pariwisata/PariwisataShell.tsx` | Dark hero shell for GCI pariwisata pages. |
| `SdiTable.vue` | `components/SdiTable.tsx` | Calls `GET {DataAPI}/sdi/{slug}?offset&limit&q` (same response shape); debounce 350ms; infinite scroll. |
| `CatalogView.vue` (`primaryOnly` prop) | `components/CatalogView.tsx` | `/katalog` and `/sdi`; needs API endpoints for the catalog + medallion map; the static secondary list (or move it to the API). |
| `ExportButton.vue` + `useSpreadsheetExport()` | `components/atlas/ExportButton.tsx`, `lib/export.ts` | CSV with BOM; lazy `xlsx` for xls/xlsx. |
| `useBasemap()` / `addBasemap` | `lib/basemap.ts` | Esri Light Gray base + reference (shadowPane), maxNativeZoom 16 / maxZoom 18; local marker icons instead of unpkg if the gov network blocks CDNs. |
| `SpatialMap.client.vue` (GmtiMapView) | `components/GmtiMapView.tsx`, `lib/spatial.ts` | markercluster, PIP choropleth, batching; needs `/api/spatial`-equivalent + geojson + ibadah json. |
| `PointMap.client.vue` | `components/charts/PointMap.tsx` | OSM tiles (inconsistent with Esri; keep for parity or switch — decide). |
| `VenueMap.client.vue` | `components/pariwisata/VenueMap.tsx` | Map + right detail panel with Google Maps iframe. |
| `DocsPage` pieces (`MethodBadge`, `CodeBlock`, `CopyButton`, `ParamTable`, highlighters) | `app/docs/docs-client.tsx` | Visual reuse; endpoint content must be rewritten for the Laravel API. |
| `HomePage` data (`sdiStats`, `secondaryDatasets`, `INDICATORS`) | `lib/sdi.ts` + `lib/sdi-data.json`, `lib/secondary.ts`, `data/gci-gpci-indicators.json` | Home is static: 182 / 19.428 / 28 / 2; cards "182 + 43 dataset", "8 indikator", "20 indikator", "19.428 baris". |
| Not to port | `components/AiDock.tsx`, `features/ai/**`, `app/ai`, `app/api/ai/**`, `lib/ai/**`, `components/MapView.tsx`, `components/SouvenirMapView.tsx`, `components/atlas/CompassRose.tsx` | AI is out of scope; the rest are orphans. |
