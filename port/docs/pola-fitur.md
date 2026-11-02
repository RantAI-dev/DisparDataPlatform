# Pola fitur (acuan plan 11–15)

Satu fitur = satu modul Laravel (`backend/app/Features/<Fitur>`) + satu layer Nuxt
(`frontend/layers/<fitur>`) + satu daftar skenario (`docs/skenario/<fitur>.md`). Contoh lengkap:
fitur **Dataset** (plan 11). Fitur lain hanya boleh menyimpang dari pola ini dengan catatan di
ADR 0001 (§Keputusan teknis) dan di PR.

Reviewer memakai bagian "Checklist" di akhir dokumen ini.

## 1. Urutan kerja

1. **Kontrak.** Baca baris fitur di `plans/2026-10-21-portal-KONTRAK.md` §2 dan bentuk JSON-nya di
   `docs/api/data-api.openapi.yaml`. Path Laravel = path Data API dengan awalan `/api`.
2. **Skenario.** Tulis `docs/skenario/<fitur>.md`: daftar ID (`XX-B01` backend, `XX-F01`
   frontend, `XX-E01` e2e, `XX-P01` paritas). Satu tes per ID, nama tes diawali ID-nya.
3. **Fixture.** Tambahkan URL Data API yang dipakai tes dan e2e ke
   `tools/fixture-server/daftar-url.txt` (di bawah judul fitur), lalu rekam dari Data API lokal:
   `DATA_API_URL=http://localhost:18080 DATA_API_TOKEN=… node tools/fixture-server/rekam.mjs`.
   Jangan menulis fixture dengan tangan. Restart `fixture-server` setelah merekam.
4. **Backend** (§2), lalu `pint` + Pest.
5. **Frontend** (§3), lalu eslint + `nuxt typecheck` + Vitest.
6. **E2E** (§4) melawan Laravel + fixture-server.
7. **Paritas** (§5) melawan `dispar.rantai.dev`, lokal.
8. **Docs API.** Ekspor ulang Scramble ke `docs/api/laravel-openapi.json`, lalu
   `npm run docs:api` di `frontend/` (halaman `/docs` dan CI membaca keduanya).

## 2. Backend `Features/<Fitur>`

```
Features/Dataset/
├─ Contracts/DatasetSource.php        satu metode per endpoint Data API, mengembalikan DataApiResponse
├─ Sources/DataApiDatasetSource.php   satu-satunya yang memakai DataApiClient / DataApiStream
├─ Services/DatasetService.php        memilih kelas baca: BacaTetap (T), BacaCache (P), aliran (S)
├─ Http/Requests/*Request.php         validasi = parameter di laravel-openapi.draft.yaml
├─ Http/Resources/DatasetResource.php ApiResponse::dariDataApi(respons, sumber, stale)
├─ Http/Controllers/DatasetController.php  tipis: Request → Service → Resource
├─ routes.php                          Route::portal + Route::apiGet(modul, kelas, varian)
└─ DatasetServiceProvider.php          bind Contract → Source, muat routes; daftar di config/app.php
```

- **Kelas baca** (SPEC §4.6, kolom "Kelas" KONTRAK):
  - **T** → `BacaTetap::baca(KunciQuery::buat('<fitur>.<endpoint>', $query), fn () => …)`.
    Endpoint T berparameter mendaftarkan `varian` di rutenya (daftar query yang disinkron plan 16).
  - **P** → `BacaCache::baca(KunciQuery::buat(...), fn () => …)`; TTL `portal.cache_menit`.
  - **S** → stream (`DataApiStream`), resource meneruskan header berkas dan mencatat jumlah baris.
- `data` tidak pernah di-decode; bila Service perlu menyusun respons (mis. `dataset/{slug}/halaman`),
  sambung string JSON mentah.
- **Docblock controller** = ringkasan (baris pertama) + deskripsi untuk Scramble. **Komentar di atas
  aturan FormRequest** = keterangan parameter di `/docs`. Untuk `f[]`, komentar ditaruh di atas `f.*`.
- Error Data API diteruskan apa adanya lewat `DataApiException` (status + `errors.code`); jangan
  ditangkap di fitur.

### Memalsukan Data API di tes

```php
beforeEach(function () {
    $this->dipanggil = dataApiDariFixture();   // tests/Pest.php: putar fixtures/data-api, 599 bila belum direkam
});

it('DS-B05 baris kelas P dibaca dari cache pada request berikutnya', function () {
    $this->getJson('/api/v1/dataset/'.S1.'/baris?page=2&size=50', tokenAkun())->assertOk();
    // …
    expect(count($this->dipanggil))->toBe(1);   // kunci Data API yang dipanggil, sudah dinormalkan
});
```

Untuk respons yang tidak bisa direkam (413, koneksi putus): `Http::swap(new Factory)` lalu
`Http::fake(...)` — fake bertumpuk, jadi pemutar fixture dari `beforeEach` harus diganti dulu.

Wajib per fitur: envelope + data byte-identik, kelas baca (snapshot/cache, hitung panggilan),
error diteruskan (404/400/413), Data API mati → 503, log (`modul`, `aksi`, `sumber`, jumlah baris),
401 tanpa token.

## 3. Frontend `layers/<fitur>`

```
layers/dataset/
├─ nuxt.config.ts            components {pathPrefix:false}; daftarkan layer di frontend/nuxt.config.ts `extends`
├─ constants.ts              teks/warna tulisan tangan v2, tiap konstanta dengan komentar `platform-v2/<file>:<baris>`
├─ composables/useDataset.ts satu fungsi per endpoint (memakai useApi); tipe respons di sini
├─ composables/useDatasetBaris.ts  keadaan halaman bila lebih dari sekadar memuat (paging, debounce, filter)
├─ components/Dataset*.vue   komponen fitur, nama BERAWALAN fitur (auto-import tidak dijaga ESLint)
├─ utils/*.ts                logika murni (diuji Vitest unit tanpa Nuxt)
└─ pages/…                   rute KONTRAK §1, sama persis dengan Next.js
```

- **Sumber paritas** = versi yang tayang di `dispar.rantai.dev` (commit image `dispar-v2`, saat
  plan 11: `464fc15`), bukan hanya `6b858eb`: komponen yang berubah setelahnya diikuti versi tayang
  (K-10). Bandingkan dengan `git diff 6b858eb <commit-tayang> -- platform-v2/<berkas>`.
- Salin kelas Tailwind dan string apa adanya; `className` → `class`, `style={{}}` → `:style`.
- Data halaman: `useAsyncData` (SSR) bila v2 server component atau datanya ada sejak muat pertama;
  muat di `onMounted` bila v2 client component yang menampilkan "Memuat…" dulu (supaya HTML SSR sama).
- Peta/ECharts/`localStorage`: hanya di browser (`onMounted`).
- Komponen dipindah ke `layers/shared` hanya bila dipakai dua fitur, sebagai commit pertama PR.

### Memalsukan API di Vitest

`tests/nuxt/<fitur>.spec.ts` memakai `registerEndpoint("/_api/<path>", handler)` dari
`@nuxt/test-utils/runtime` (jalur browser `useApi`). Logika murni di `tests/unit/<fitur>.spec.ts`.

## 4. E2E (`frontend/tests/e2e/<fitur>.spec.ts`)

- Melawan Nuxt + Laravel + fixture-server; **tidak** memalsukan rute di browser. Rekaman yang kurang
  muncul sebagai 599 `FIXTURE_TIDAK_ADA` di respons.
- Buka halaman lalu tunggu `networkidle` sebelum klik (hidrasi).
- Lokal: `compose.dev.yaml` dengan backend diarahkan ke fixture-server dan
  `PORTAL_BATAS_PER_MENIT` tinggi, lalu
  `E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/<fitur>.spec.ts`.
- CI: `scripts/ci/e2e.sh` menyalakan fixture-server + Laravel (`scripts/ci/laravel-e2e.sh`).

## 5. Paritas (`frontend/tests/parity/<fitur>.spec.ts`)

```ts
test("DS-P04 /sdi/S1", async ({ browser, page }, info) => {
  await bandingkanHalaman(browser, page, `/sdi/${S1}`, info, { tunggu: "text=lihat di portal ↗", samakanBaris: { … } });
});
```

`tests/parity/bantu.ts` membuka produksi dan portal pada viewport yang sama (1440×900 dan 390×844),
menyamakan keadaan (font, `networkidle`, animasi), lalu:

1. **Angka**: himpunan token angka di `<main>` harus identik (`abaikanAngka` = whitelist P4).
2. **Visual**: tangkapan produksi menjadi pembanding `toMatchSnapshot` dengan
   `maxDiffPixelRatio: 0.02`. Halaman ber-canvas memakai viewport setinggi dokumen.

Selalu: header di-mask (item asisten AI/Jekate tidak di-port), dock AI dibuang dari produksi.
Data yang tidak deterministik (baris tanpa ORDER BY) disamakan dengan `samakanBaris`, bukan di-mask.
Pengecualian lain (P1–P5) ditulis sebagai `mask` + komentar alasannya di spec.

Jalankan: portal dev diarahkan ke Data API lokal (data hidup), lalu
`PORTAL_URL=http://127.0.0.1:3000 npx playwright test -c playwright.parity.config.ts tests/parity/<fitur>.spec.ts`.
Laporan HTML: `frontend/playwright-report/parity/`.

## 6. Gate sebelum commit

```bash
# backend (Oracle + fixture-server dari compose.dev.yaml)
docker compose -f compose.dev.yaml run --rm backend sh -c 'vendor/bin/pint --test && vendor/bin/pest'
# frontend
cd frontend && npm run lint && npx nuxt typecheck && npx vitest run
E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test
```

## Checklist reviewer

- [ ] Setiap rute KONTRAK fitur ini ada, dengan kelas (T/P/S) dan `varian` yang benar.
- [ ] Controller hanya Request → Service → Resource; `tests/Arch` lulus.
- [ ] Docblock controller + komentar aturan ada; `docs/api/laravel-openapi.json` dan
      `layers/docs/data/endpoints.json` diperbarui.
- [ ] Fixture direkam (bukan ditulis tangan); daftar URL di bawah judul fitur.
- [ ] `docs/skenario/<fitur>.md`: setiap ID punya tes yang lulus.
- [ ] String, kelas, dan konstanta tampilan sama dengan versi tayang; sumbernya dikomentari.
- [ ] Komponen fitur berawalan nama fitur; tidak ada impor lintas layer.
- [ ] Paritas semua rute fitur lulus, atau pengecualiannya tertulis di spec + ADR.
