<?php

use App\Features\Dashboard\Services\DashboardService;
use App\Shared\DataApi\JsonMentah;
use App\Shared\LogHistory\LogHistory;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Http;

/* Skenario backend fitur dashboard (docs/skenario/dashboard.md, DB-B*). */

beforeEach(function () {
    $this->dipanggil = dataApiDariFixture();
});

/** Satu URL contoh per endpoint (semua terekam di fixtures/data-api). */
function contohDashboard(): array
{
    return [
        'ringkasan' => '', 'wisman/tahunan' => '', 'wisman/bulanan' => '?periode=2024-05',
        'wisman/kebangsaan' => '?tahun=2024&top=8', 'wisman/pintu-masuk' => '?periode=2024-05',
        'lama-menginap/rata-rata' => '', 'lama-menginap/per-kelas' => '?tamu=wisnus', 'lama-menginap/seri' => '?tamu=wisnus',
        'wisnus/meta' => '', 'wisnus/tahunan' => '?kota=Jakarta%20Pusat', 'wisnus/per-kota' => '?tahun=2025',
        'wisnus/bulanan' => '?kota=Jakarta%20Pusat', 'wisnus/yoy' => '',
        'destinasi/meta' => '?jenis=wisman', 'destinasi/ringkasan' => '?jenis=wisnus&tahun=2025',
        'destinasi/per-destinasi' => '?jenis=wisman&tahun=2025', 'destinasi/bulanan' => '?jenis=wisnus',
        'tenaga-kerja/dki' => '', 'tenaga-kerja/subsektor' => '?tahun=2022', 'tenaga-kerja/sertifikasi' => '',
        'pdrb-ekraf/makro' => '', 'pdrb-ekraf/subsektor/sebaran' => '?periode=2022',
        'pdrb-ekraf/subsektor/pertumbuhan' => '?periode=S1%202025',
    ];
}

it('DB-B01 tiap endpoint KONTRAK §2.2 diteruskan dengan data byte-identik', function () {
    expect(array_keys(contohDashboard()))->toEqualCanonicalizing(array_keys(DashboardService::KELAS));

    foreach (contohDashboard() as $endpoint => $query) {
        $res = $this->getJson("/api/v1/dashboard/$endpoint$query", tokenAkun())->assertOk();
        $kunci = kunciFixture("/v1/dashboard/$endpoint$query");
        $asal = collect(glob(dirname(__DIR__, 3).'/../fixtures/data-api/*.json'))
            ->map(fn ($b) => json_decode(file_get_contents($b), true))->firstWhere('kunci', $kunci);
        expect(JsonMentah::nilaiMentah($res->getContent(), 'data'))->toBe(JsonMentah::nilaiMentah($asal['body'], 'data'), $endpoint);
    }
});

it('DB-B02 kelas T dibaca dari snapshot, kelas P dari cache', function () {
    $this->getJson('/api/v1/dashboard/lama-menginap/seri?tamu=wisnus', tokenAkun());
    $this->getJson('/api/v1/dashboard/wisman/kebangsaan?tahun=2024&top=8', tokenAkun());

    expect($this->getJson('/api/v1/dashboard/lama-menginap/seri?tamu=wisnus', tokenAkun())->json('meta.sumber'))->toBe('snapshot')
        ->and($this->getJson('/api/v1/dashboard/wisman/kebangsaan?top=8&tahun=2024', tokenAkun())->json('meta.sumber'))->toBe('cache')
        ->and(count($this->dipanggil))->toBe(2);
});

it('DB-B03 parameter di luar kontrak ditolak 422 tanpa memanggil Data API', function (string $alamat) {
    $this->getJson("/api/v1/dashboard/$alamat", tokenAkun())->assertStatus(422)->assertJsonPath('errors.code', 'INVALID_PARAM');

    expect(count($this->dipanggil))->toBe(0);
})->with([
    'tamu wajib' => ['lama-menginap/per-kelas'],
    'tamu tak dikenal' => ['lama-menginap/seri?tamu=turis'],
    'jenis wajib' => ['destinasi/meta'],
    'tahun bukan YYYY' => ['wisnus/per-kota?tahun=25'],
    'periode bukan YYYY-MM' => ['wisman/bulanan?periode=2024'],
    'top > 50' => ['wisman/kebangsaan?top=100'],
]);

it('DB-B04 Data API mati → 503 envelope', function () {
    Http::swap(new Factory);
    Http::fake(fn () => throw new ConnectionException('mati'));

    $this->getJson('/api/v1/dashboard/wisman/tahunan', tokenAkun())
        ->assertStatus(503)
        ->assertJsonPath('errors.code', 'UPSTREAM_UNAVAILABLE');
});

it('DB-B05 tercatat di LOG_HISTORY dengan modul dashboard dan nama rute', function () {
    $this->getJson('/api/v1/dashboard/destinasi/ringkasan?jenis=wisnus&tahun=2025', tokenAkun())->assertOk();

    $log = LogHistory::sole();
    expect([$log->modul, $log->aksi, $log->sumber])->toBe(['dashboard', 'dashboard.destinasi.ringkasan', 'data_api']);
});

it('DB-B06 tanpa token → 401', function () {
    $this->getJson('/api/v1/dashboard/ringkasan')->assertUnauthorized();
});
