<script setup lang="ts">
/**
 * Dokumentasi REST API (app/docs/docs-client.tsx v2). Tata letak sama; isi endpoint (P3) dihasilkan
 * dari ekspor Scramble lewat `scripts/docs-dari-openapi.ts` → `data/endpoints.json`, jadi tidak
 * bisa basi. Base URL dari env (`NUXT_PUBLIC_API_BASE_URL`).
 */
import endpointsJson from "../data/endpoints.json";
import type { DocEndpoint } from "../../../scripts/docs-dari-openapi";

useHead({
  title: "Dokumentasi API — Platform Data Pariwisata & Ekraf DKI Jakarta",
  meta: [
    {
      name: "description",
      content:
        "Referensi REST API Platform Data Dinas Pariwisata & Ekonomi Kreatif Provinsi DKI Jakarta: katalog dataset, detail & baris data, ekspor CSV/XLSX, serta endpoint admin.",
    },
  ],
});

const ENDPOINTS = endpointsJson as DocEndpoint[];
const BASE_URL = useRuntimeConfig().public.apiBaseUrl.replace(/\/+$/, "");
const IN_LABEL = { path: "path", query: "query", header: "header" } as const;

const curl = (ep: DocEndpoint) => `curl -H "Authorization: Bearer $TOKEN" \\\n  "${BASE_URL}${ep.contoh}"${ep.respons === "berkas" ? " -OJ" : ""}`;
const RESPONS_JSON = `{
  "success": true,
  "message": "OK",
  "data": { … },
  "meta": {
    "request_id": "8f0c…",
    "sumber": "data_api",
    "stale": false
  }
}`;
const RESPONS_BERKAS = `HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="{slug}.csv"
X-Row-Count: 1088`;
const GALAT = `{
  "success": false,
  "message": "Data tidak ditemukan.",
  "errors": { "code": "NOT_FOUND" },
  "meta": { "request_id": "8f0c…" }
}`;
const STATUS = [
  ["200", "Berhasil."],
  ["400", "Filter atau parameter ditolak sumber data (mis. kolom tidak dikenal)."],
  ["401", "Token tidak dikirim atau tidak valid."],
  ["404", "Dataset atau alamat tidak ditemukan."],
  ["413", "Ekspor melebihi 100.000 baris."],
  ["422", "Parameter tidak sesuai aturan; rincian di errors.fields."],
  ["429", "Terlalu banyak permintaan; coba lagi sebentar lagi."],
  ["503", "Sumber data sedang tidak tersedia."],
] as const;

const NAV_SECTIONS = [{ id: "pengantar", label: "Pengantar" }, ...ENDPOINTS.map((e) => ({ id: e.id, label: e.title })), { id: "status", label: "Kode status" }];

const active = ref("pengantar");
let spy: IntersectionObserver | null = null;
onMounted(() => {
  const visible = new Map<string, number>();
  spy = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) visible.set(en.target.id, en.boundingClientRect.top);
        else visible.delete(en.target.id);
      }
      if (visible.size) active.value = [...visible.entries()].sort((a, b) => a[1] - b[1])[0]![0];
    },
    { rootMargin: "-96px 0px -55% 0px", threshold: 0 },
  );
  NAV_SECTIONS.map((s) => document.getElementById(s.id)).forEach((el) => el && spy?.observe(el));
});
onBeforeUnmount(() => spy?.disconnect());
const contohTercepat = `curl -H "Authorization: Bearer $TOKEN" ${BASE_URL}/api/v1/katalog | jq ".meta.total"`;
</script>

<template>
  <main class="min-h-screen bg-paper">
    <component :is="'style'">
      .tok-key { color: #f4a06b; } .tok-str { color: #d9c98f; } .tok-num { color: #8fd3b6; } .tok-cmd { color: #f4a06b; font-weight: 600; } .tok-flag {
      color: #b8ab99; } .tok-url { color: #9fc4e8; }
    </component>

    <section class="bg-hero text-white">
      <div class="mx-auto max-w-[1320px] px-6 pt-14 pb-16">
        <div class="atlas-mono mb-5" style="color: var(--accent-soft)">Dokumentasi · REST API · v1</div>
        <h1 class="atlas-display max-w-[720px]">API Data Pariwisata <span class="atlas-italic" style="color: var(--accent-soft)">&amp; Ekonomi Kreatif</span></h1>
        <p class="atlas-lead mt-5 max-w-[640px]" style="color: rgba(255, 255, 255, 0.72)">
          Akses terprogram ke katalog dataset Dinas Pariwisata &amp; Ekonomi Kreatif Provinsi DKI Jakarta — katalog, isi tabel terpaginasi,
          pencarian, dan ekspor CSV/XLSX. Seluruh respons berformat JSON.
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-3 rounded-xl px-4 py-2.5" style="background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.14)">
            <span class="atlas-mono" style="color: #8d8172">Base URL</span>
            <code class="text-[13.5px]" style="font-family: var(--font-mono); color: #f0e9df">{{ BASE_URL }}</code>
            <DocsCopyButton :text="BASE_URL" />
          </div>
          <span
            v-for="t in [`${ENDPOINTS.length} endpoint`, 'JSON', 'Token layanan (Bearer)']"
            :key="t"
            class="rounded-full px-3.5 py-1.5 text-[12px] font-medium"
            style="background: rgba(237, 107, 35, 0.16); border: 1px solid rgba(237, 107, 35, 0.35); color: #f7c39e"
          >{{ t }}</span>
        </div>
      </div>
    </section>

    <div class="mx-auto max-w-[1320px] px-6 py-12 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
      <aside class="mb-10 lg:mb-0">
        <nav class="lg:sticky lg:top-[98px] flex flex-row flex-wrap gap-1 lg:flex-col">
          <div class="atlas-mono mb-2 hidden w-full lg:block" style="color: var(--body-muted)">Di halaman ini</div>
          <a
            v-for="s in NAV_SECTIONS"
            :key="s.id"
            :href="`#${s.id}`"
            class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] transition-colors"
            :style="active === s.id ? { background: 'var(--accent-bg)', color: 'var(--accent-deep)', fontWeight: 600 } : { color: 'var(--ink-muted-48)' }"
          >
            <DocsMethodBadge v-if="ENDPOINTS.find((e) => e.id === s.id)" :method="ENDPOINTS.find((e) => e.id === s.id)!.method" small />
            {{ s.label }}
          </a>
          <NuxtLink to="/sdi" class="mt-4 hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium lg:flex" style="color: var(--link)">
            Jelajahi katalog
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </NuxtLink>
        </nav>
      </aside>

      <div class="min-w-0 space-y-14">
        <section id="pengantar" class="scroll-mt-[98px]">
          <h2 class="atlas-display-md text-ink">Pengantar</h2>
          <div class="apple-body mt-4 max-w-[760px] space-y-4 text-ink-muted-80">
            <p>
              API ini menyajikan data yang sama dengan yang tampil di platform — bersumber dari
              <strong class="text-ink">Satu Data Indonesia (SDI) Jakarta</strong> dan dataset sekunder internal Dinas, yang ditarik terjadwal
              ke lakehouse Dinas. Semua endpoint bersifat <strong class="text-ink">baca saja</strong> dan memerlukan token layanan di header
              <code class="rounded px-1 py-0.5 text-[13px]" style="font-family: var(--font-mono); background: var(--paper-deep)">Authorization: Bearer</code>.
            </p>
            <p>
              Setiap respons dibungkus envelope <code class="text-[13px]" style="font-family: var(--font-mono)">{ success, message, data, meta }</code>.
              Bidang <code class="text-[13px]" style="font-family: var(--font-mono)">meta.sumber</code> menunjukkan asal data: <em>data_api</em>,
              <em>cache</em>, atau <em>snapshot</em> harian; <code class="text-[13px]" style="font-family: var(--font-mono)">meta.stale</code> bernilai
              true bila snapshot lebih tua dari 36 jam.
            </p>
          </div>
          <div class="mt-6">
            <DocsCodeBlock label="Contoh tercepat" :code="contohTercepat" :html="sorotShell(contohTercepat)" />
          </div>
        </section>

        <section v-for="ep in ENDPOINTS" :id="ep.id" :key="ep.id" class="scroll-mt-[98px]">
          <div class="flex flex-wrap items-center gap-3">
            <DocsMethodBadge :method="ep.method" />
            <code class="text-[15px] font-semibold text-ink" style="font-family: var(--font-mono)">{{ ep.path }}</code>
          </div>
          <h2 class="atlas-display-md mt-3 text-ink">{{ ep.title }}</h2>
          <p class="apple-body mt-3 max-w-[760px] text-ink-muted-80" v-html="kodeSebaris(ep.desc)" />

          <div v-if="ep.params.length > 0" class="mt-6">
            <div class="apple-caption-strong mb-2.5 text-ink">Parameter</div>
            <div class="overflow-x-auto rounded-xl border border-hairline bg-canvas">
              <table class="w-full text-left text-[13px]">
                <thead>
                  <tr class="border-b border-hairline">
                    <th class="px-4 py-2.5 font-semibold text-ink">Parameter</th>
                    <th class="px-4 py-2.5 font-semibold text-ink">Letak</th>
                    <th class="px-4 py-2.5 font-semibold text-ink">Tipe</th>
                    <th class="px-4 py-2.5 font-semibold text-ink">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in ep.params" :key="p.name + p.in" class="border-b border-divider last:border-0 align-top">
                    <td class="px-4 py-3 whitespace-nowrap">
                      <code class="rounded-md px-1.5 py-0.5 text-[12px]" style="font-family: var(--font-mono); background: var(--paper-deep); color: var(--ink)">{{ p.name }}</code>
                      <span v-if="p.required" class="ml-2 text-[10.5px] font-semibold uppercase tracking-wide" style="color: var(--accent-deep)">wajib</span>
                    </td>
                    <td class="px-4 py-3 text-ink-muted-48 whitespace-nowrap">{{ IN_LABEL[p.in] }}</td>
                    <td class="px-4 py-3 whitespace-nowrap" style="font-family: var(--font-mono); font-size: 12px; color: var(--ink-muted-80)">{{ p.type }}</td>
                    <td class="px-4 py-3 text-ink-muted-80" v-html="kodeSebaris(p.desc)" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="mt-6 grid gap-4 xl:grid-cols-2">
            <DocsCodeBlock label="Permintaan" :code="curl(ep)" :html="sorotShell(curl(ep))" />
            <DocsCodeBlock
              :label="ep.respons === 'berkas' ? 'Respons (header)' : 'Respons 200'"
              :code="ep.respons === 'berkas' ? RESPONS_BERKAS : RESPONS_JSON"
              :html="ep.respons === 'berkas' ? sorotHttp(RESPONS_BERKAS) : sorotJson(RESPONS_JSON)"
            />
          </div>

          <div v-if="ep.errors.length > 0" class="mt-5 overflow-hidden rounded-xl border border-hairline bg-canvas">
            <div v-for="er in ep.errors" :key="er.code" class="flex items-start gap-3 border-b border-divider px-4 py-2.5 text-[13px] last:border-0">
              <code
                class="mt-px shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-semibold"
                style="font-family: var(--font-mono); background: rgba(190, 40, 40, 0.08); color: #b03030"
              >{{ er.code }}</code>
              <span class="text-ink-muted-80">{{ er.when }}</span>
            </div>
          </div>
        </section>

        <section id="status" class="scroll-mt-[98px]">
          <h2 class="atlas-display-md text-ink">Kode status</h2>
          <p class="apple-body mt-3 max-w-[760px] text-ink-muted-80">
            API memakai kode status HTTP standar. Galat selalu dikembalikan sebagai envelope JSON dengan
            <code class="text-[13px]" style="font-family: var(--font-mono)">success: false</code> dan kode galat di
            <code class="text-[13px]" style="font-family: var(--font-mono)">errors.code</code>.
          </p>
          <div class="mt-5 overflow-hidden rounded-xl border border-hairline bg-canvas">
            <div v-for="[code, when] in STATUS" :key="code" class="flex items-start gap-3 border-b border-divider px-4 py-2.5 text-[13px] last:border-0">
              <code
                class="mt-px w-10 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[12px] font-semibold"
                :style="{ fontFamily: 'var(--font-mono)', background: code === '200' ? 'rgba(22,128,90,0.1)' : 'rgba(190,40,40,0.08)', color: code === '200' ? '#0f7a54' : '#b03030' }"
              >{{ code }}</code>
              <span class="text-ink-muted-80">{{ when }}</span>
            </div>
          </div>
          <div class="mt-6">
            <DocsCodeBlock label="Bentuk galat" :code="GALAT" :html="sorotJson(GALAT)" />
          </div>
        </section>

        <footer class="border-t border-hairline pt-6 pb-2 text-[12.5px] text-body-muted">
          Dinas Pariwisata &amp; Ekonomi Kreatif Provinsi DKI Jakarta · Sumber data:
          <a href="https://satudata.jakarta.go.id" target="_blank" rel="noreferrer" class="text-link">Satu Data Indonesia — Jakarta</a>
        </footer>
      </div>
    </div>
  </main>
</template>
