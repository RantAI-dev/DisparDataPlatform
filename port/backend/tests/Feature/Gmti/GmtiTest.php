<?php

use App\Shared\DataApi\JsonMentah;
use App\Shared\LogHistory\LogHistory;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Http;

/* Skenario backend gmti, spasial, hotel-scraped (docs/skenario/gmti.md, GM-B*). */

beforeEach(function () {
    $this->dipanggil = dataApiDariFixture();
    $this->rekaman = fn (string $kunci) => collect(glob(dirname(__DIR__, 3).'/../fixtures/data-api/*.json'))
        ->map(fn ($b) => json_decode(file_get_contents($b), true))->firstWhere('kunci', $kunci)['body'];
});

it('GM-B01 tiap endpoint KONTRAK §2.5 diteruskan dengan data byte-identik', function (string $laravel, string $dataApi) {
    $res = $this->getJson("/api/v1/$laravel", tokenAkun())->assertOk();

    expect(JsonMentah::nilaiMentah($res->getContent(), 'data'))->toBe(JsonMentah::nilaiMentah(($this->rekaman)($dataApi), 'data'));
})->with([
    ['gmti/ringkasan', '/v1/gmti/ringkasan'],
    ['gmti/tempat?page=1&size=200&pilar=makan&kota=Jakarta%20Selatan', '/v1/gmti/tempat?kota=Jakarta%20Selatan&page=1&pilar=makan&size=200'],
    ['spasial', '/v1/spasial'],
    ['spasial/titik/gci-osm-w-370539428', '/v1/spasial/titik/gci-osm-w-370539428'],
    ['hotel-scraped', '/v1/hotel-scraped'],
]);

it('GM-B02 kelas baca: ringkasan/spasial dari snapshot, tempat dan titik dari cache', function () {
    $jalur = ['gmti/ringkasan', 'spasial', 'gmti/tempat?page=1&size=200&pilar=program', 'spasial/titik/gci-osm-w-370539428'];
    foreach ($jalur as $j) {
        $this->getJson("/api/v1/$j", tokenAkun());
    }

    expect(collect($jalur)->map(fn ($j) => $this->getJson("/api/v1/$j", tokenAkun())->json('meta.sumber'))->all())
        ->toBe(['snapshot', 'snapshot', 'cache', 'cache'])
        ->and(count($this->dipanggil))->toBe(4);
});

it('GM-B03 parameter di luar kontrak → 422 tanpa memanggil Data API', function (string $alamat) {
    $this->getJson("/api/v1/$alamat", tokenAkun())->assertStatus(422);

    expect(count($this->dipanggil))->toBe(0);
})->with(['gmti/tempat?size=201', 'gmti/tempat?pilar=wisata', 'gmti/tempat?page=0', 'hotel-scraped?limit=501']);

it('GM-B04 titik tak dikenal → 404 Data API diteruskan', function () {
    Http::swap(new Factory);
    Http::fake(['*' => Http::response(['detail' => ['code' => 'NOT_FOUND', 'message' => 'Titik tidak ada']], 404)]);

    $this->getJson('/api/v1/spasial/titik/tidak-ada', tokenAkun())->assertNotFound()->assertJsonPath('errors.code', 'NOT_FOUND');
});

it('GM-B05 Data API mati tanpa snapshot → 503, satu percobaan', function () {
    Http::swap(new Factory);
    $percobaan = 0;
    Http::fake(function () use (&$percobaan) {
        $percobaan++;
        throw new ConnectionException('mati');
    });

    $this->getJson('/api/v1/spasial', tokenAkun())->assertStatus(503)->assertJsonPath('errors.code', 'UPSTREAM_UNAVAILABLE');
    expect($percobaan)->toBe(1);
});

it('GM-B06 LOG_HISTORY per modul', function (string $jalur, string $modul, string $aksi) {
    $this->getJson("/api/v1/$jalur", tokenAkun())->assertOk();
    expect([LogHistory::sole()->modul, LogHistory::sole()->aksi])->toBe([$modul, $aksi]);
})->with([
    ['gmti/ringkasan', 'gmti', 'gmti.ringkasan'],
    ['spasial', 'spasial', 'spasial.index'],
    ['hotel-scraped', 'hotel-scraped', 'hotel-scraped'],
]);

it('GM-B07 tanpa token → 401', function () {
    $this->getJson('/api/v1/spasial')->assertUnauthorized();
});
