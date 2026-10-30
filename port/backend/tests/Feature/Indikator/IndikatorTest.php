<?php

use App\Shared\DataApi\JsonMentah;
use App\Shared\LogHistory\LogHistory;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Http;

/* Skenario backend fitur indikator (docs/skenario/indikator.md, IN-B*). */

beforeEach(function () {
    $this->dipanggil = dataApiDariFixture();
});

function bodyRekaman(string $kunci): string
{
    return collect(glob(dirname(__DIR__, 3).'/../fixtures/data-api/*.json'))
        ->map(fn ($b) => json_decode(file_get_contents($b), true))->firstWhere('kunci', $kunci)['body'];
}

it('IN-B01 tiap endpoint KONTRAK §2.3 diteruskan dengan data byte-identik', function (string $laravel, string $dataApi) {
    $res = $this->getJson("/api/v1/$laravel", tokenAkun())->assertOk();

    expect(JsonMentah::nilaiMentah($res->getContent(), 'data'))->toBe(JsonMentah::nilaiMentah(bodyRekaman($dataApi), 'data'));
})->with([
    ['indikator?framework=GCI', '/v1/indikator?framework=GCI'],
    ['indikator/CI-MU', '/v1/indikator/CI-MU'],
    ['indikator/ac-ap', '/v1/indikator/AC-AP'],
    ['gci/resmi', '/v1/gci/resmi'],
    ['dataset-tematik?framework=GPCI', '/v1/dataset-tematik?framework=GPCI'],
    ['pariwisata/wisatawan-internasional', '/v1/pariwisata/wisatawan-internasional'],
    ['pariwisata/kuliner-michelin', '/v1/pariwisata/kuliner-michelin'],
    ['pariwisata/seni-pertunjukan?tahun=2025', '/v1/pariwisata/seni-pertunjukan?tahun=2025'],
]);

it('IN-B02 detail kelas T dari snapshot; seni-pertunjukan per tahun kelas P dari cache (respons > 32 KB)', function () {
    $this->getJson('/api/v1/indikator/CE1', tokenAkun());
    $this->getJson('/api/v1/pariwisata/seni-pertunjukan', tokenAkun());

    expect($this->getJson('/api/v1/indikator/CE1', tokenAkun())->json('meta.sumber'))->toBe('snapshot')
        ->and($this->getJson('/api/v1/pariwisata/seni-pertunjukan', tokenAkun())->json('meta.sumber'))->toBe('cache')
        ->and(strlen(bodyRekaman('/v1/pariwisata/seni-pertunjukan')))->toBeGreaterThan(32 * 1024)
        ->and(count($this->dipanggil))->toBe(2);
});

it('IN-B03 kode tak dikenal → 404 envelope', function () {
    $this->getJson('/api/v1/indikator/ZZZ', tokenAkun())->assertNotFound()->assertJsonPath('errors.code', 'NOT_FOUND');
});

it('IN-B04 parameter di luar kontrak → 422 tanpa memanggil Data API', function (string $alamat) {
    $this->getJson("/api/v1/$alamat", tokenAkun())->assertStatus(422);

    expect(count($this->dipanggil))->toBe(0);
})->with(['indikator', 'indikator?framework=SDGs', 'dataset-tematik', 'pariwisata/seni-pertunjukan?tahun=25']);

it('IN-B05 satu percobaan dengan timeout panjang; Data API mati → 503', function () {
    Http::swap(new Factory);
    $percobaan = 0;
    Http::fake(function () use (&$percobaan) {
        $percobaan++;
        throw new ConnectionException('mati');
    });

    $this->getJson('/api/v1/indikator/CE1', tokenAkun())->assertStatus(503);
    expect($percobaan)->toBe(1)->and(config('dataapi.timeout_lambat'))->toBe(60);
});

it('IN-B06 LOG_HISTORY modul indikator', function () {
    $this->getJson('/api/v1/gci/resmi', tokenAkun())->assertOk();
    expect([LogHistory::sole()->modul, LogHistory::sole()->aksi])->toBe(['indikator', 'indikator.gci-resmi']);
});

it('IN-B07 tanpa token → 401', function () {
    $this->getJson('/api/v1/gci/resmi')->assertUnauthorized();
});
