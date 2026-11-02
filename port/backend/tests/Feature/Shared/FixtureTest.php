<?php

use App\Shared\DataApi\JsonMentah;
use Illuminate\Support\Facades\Http;

/*
| Setiap rekaman di fixtures/data-api lewat jalur Shared yang sesungguhnya (DataApiClient →
| ApiResponse) harus keluar dengan `data` byte-identik, meta Data API ikut, dan status error
| terbawa (plan 10, SPEC §4.4).
*/

/** @return array<string, array{0: string}> */
function berkasFixture(): array
{
    $dir = dirname(__DIR__, 4).'/fixtures/data-api'; // port/fixtures, dari backend/tests/Feature/Shared
    $daftar = glob($dir.'/*.json') ?: [];

    return array_combine(array_map('basename', $daftar), array_map(fn ($b) => [$b], $daftar));
}

/**
 * Alamat portal untuk kunci fixture Data API. Parameter berulang (f=a&f=b) ditulis f[]=, seperti
 * yang dikirim Nuxt: PHP menelan f= berulang (SPEC §4.4).
 */
function alamatPortal(string $kunci): string
{
    [$path, $query] = array_pad(explode('?', ltrim($kunci, '/'), 2), 2, '');
    $pasangan = array_map(fn ($p) => explode('=', $p, 2), array_filter(explode('&', $query)));
    $jumlah = array_count_values(array_column($pasangan, 0));
    $query = implode('&', array_map(fn ($p) => ($jumlah[$p[0]] > 1 ? $p[0].'[]' : $p[0]).'='.$p[1], $pasangan));

    return '/api/v1/uji/teruskan/'.$path.($query ? '?'.$query : '');
}

beforeEach(fn () => daftarkanRuteUji());

it('ada fixture untuk diuji', function () {
    expect(berkasFixture())->not->toBeEmpty();
});

it('meneruskan fixture tanpa mengubah data, meta, atau status', function (string $berkas) {
    $r = json_decode(file_get_contents($berkas), true);
    Http::fake(['data-api.test/*' => Http::response($r['body'], $r['status'], $r['headers'])]);
    $res = $this->getJson(alamatPortal($r['kunci']), tokenAkun());

    $res->assertStatus($r['status']);
    if ($r['status'] !== 200) {
        $res->assertJson(['success' => false, 'errors' => ['code' => json_decode($r['body'])->error->code]]);

        return;
    }
    // /v1/health tidak berbentuk {"data":…}; data yang diteruskan memang null.
    expect(JsonMentah::nilaiMentah($res->getContent(), 'data'))->toBe(JsonMentah::nilaiMentah($r['body'], 'data') ?? 'null');
    $metaAsal = json_decode($r['body'], true)['meta'] ?? [];
    // Meta portal = meta Data API + request_id/sumber/stale milik portal.
    $tambahanPortal = ['request_id' => 1, 'sumber' => 1, 'stale' => 1];
    expect(array_diff_key($res->json('meta'), $tambahanPortal))->toEqual(array_diff_key($metaAsal, $tambahanPortal));
    Http::assertSent(fn ($req) => str_ends_with(urldecode($req->url()), urldecode($r['kunci'])));
})->with(berkasFixture());
