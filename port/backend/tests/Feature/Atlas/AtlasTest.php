<?php

use App\Shared\DataApi\JsonMentah;
use App\Shared\LogHistory\LogHistory;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Http;

/* Skenario backend fitur atlas (docs/skenario/atlas.md, AT-B*). */

beforeEach(function () {
    $this->dipanggil = dataApiDariFixture();
    $this->rekaman = fn (string $kunci) => collect(glob(dirname(__DIR__, 3).'/../fixtures/data-api/*.json'))
        ->map(fn ($b) => json_decode(file_get_contents($b), true))->firstWhere('kunci', $kunci)['body'];
});

it('AT-B01 tiap endpoint KONTRAK §2.4 diteruskan dengan data byte-identik', function (string $jalur) {
    $res = $this->getJson("/api/v1/$jalur", tokenAkun())->assertOk();

    expect(JsonMentah::nilaiMentah($res->getContent(), 'data'))->toBe(JsonMentah::nilaiMentah(($this->rekaman)("/v1/$jalur"), 'data'));
})->with([
    'atlas/restoran-gci', 'atlas/direktori-restoran', 'atlas/golf', 'atlas/suvenir', 'atlas/hotel',
    'atlas/pertunjukan', 'atlas/pertunjukan?tahun=2025',
]);

it('AT-B02 kelas T: request kedua dari snapshot, per tahun terpisah', function () {
    foreach (['atlas/direktori-restoran', 'atlas/pertunjukan', 'atlas/pertunjukan?tahun=2026'] as $jalur) {
        $this->getJson("/api/v1/$jalur", tokenAkun());
        expect($this->getJson("/api/v1/$jalur", tokenAkun())->json('meta.sumber'))->toBe('snapshot');
    }

    expect(count($this->dipanggil))->toBe(3);
});

it('AT-B03 tahun di luar kontrak → 422 tanpa memanggil Data API', function (string $tahun) {
    $this->getJson("/api/v1/atlas/pertunjukan?tahun=$tahun", tokenAkun())->assertStatus(422);

    expect(count($this->dipanggil))->toBe(0);
})->with(['25', 'abcd']);

it('AT-B04 Data API mati tanpa snapshot → 503, satu percobaan', function () {
    Http::swap(new Factory);
    $percobaan = 0;
    Http::fake(function () use (&$percobaan) {
        $percobaan++;
        throw new ConnectionException('mati');
    });

    $this->getJson('/api/v1/atlas/golf', tokenAkun())->assertStatus(503)->assertJsonPath('errors.code', 'UPSTREAM_UNAVAILABLE');
    expect($percobaan)->toBe(1);
});

it('AT-B05 LOG_HISTORY modul atlas', function () {
    $this->getJson('/api/v1/atlas/suvenir', tokenAkun())->assertOk();
    expect([LogHistory::sole()->modul, LogHistory::sole()->aksi])->toBe(['atlas', 'atlas.suvenir']);
});

it('AT-B06 tanpa token → 401', function () {
    $this->getJson('/api/v1/atlas/golf')->assertUnauthorized();
});
