<?php

use App\Shared\DataApi\DataApiClient;
use App\Shared\DataApi\DataApiException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => daftarkanRuteUji());

it('mengirim f[] sebagai f= berulang dan meng-encode nilainya', function () {
    Http::fake(['data-api.test/*' => Http::response('{"data":[],"meta":{}}')]);

    $this->getJson('/api/v1/uji/dataapi?f[]=nama~a%26b&f[]=kota=Jakarta%20Barat&kosong=&page=2', tokenAkun())->assertOk();

    Http::assertSent(function (Request $req) {
        $query = parse_url($req->url(), PHP_URL_QUERY);

        return $query === 'f=nama~a%26b&f=kota%3DJakarta%20Barat&page=2';
    });
});

it('mengulang dua kali untuk 5xx lalu berhasil', function () {
    Http::fakeSequence('data-api.test/*')
        ->push('{"error":{"code":"UPSTREAM_UNAVAILABLE"}}', 503)
        ->push('gagal', 500)
        ->push('{"data":{"ok":true},"meta":{}}');

    $r = app(DataApiClient::class)->get('/v1/uji');

    expect($r->data)->toBe('{"ok":true}');
    Http::assertSentCount(3);
});

it('tidak mengulang untuk 4xx', function () {
    Http::fake(['data-api.test/*' => Http::response('{"error":{"code":"NOT_FOUND"}}', 404)]);

    expect(fn () => app(DataApiClient::class)->get('/v1/uji'))
        ->toThrow(fn (DataApiException $e) => expect([$e->kode, $e->status])->toBe(['NOT_FOUND', 404]));
    Http::assertSentCount(1);
});

it('memetakan timeout/koneksi gagal menjadi 503 setelah dua kali ulang', function () {
    // Http::fake tidak merekam percobaan yang melempar exception; hitung sendiri.
    $percobaan = 0;
    Http::fake(function () use (&$percobaan) {
        $percobaan++;
        throw new ConnectionException('timeout');
    });

    $this->getJson('/api/v1/uji/dataapi', tokenAkun())
        ->assertStatus(503)
        ->assertJson(['errors' => ['code' => 'UPSTREAM_UNAVAILABLE']]);
    expect($percobaan)->toBe(3);
});

it('memetakan 401/403 Data API (token layanan salah) menjadi 502, bukan 401', function () {
    Http::fake(['data-api.test/*' => Http::response('{"error":{"code":"UNAUTHORIZED"}}', 401)]);

    $this->getJson('/api/v1/uji/dataapi', tokenAkun())
        ->assertStatus(502)
        ->assertJson(['errors' => ['code' => 'UPSTREAM_AUTH']]);
});

it('meneruskan token layanan dan X-Request-Id', function () {
    Http::fake(['data-api.test/*' => Http::response('{"data":null,"meta":{}}')]);

    $r = $this->getJson('/api/v1/uji/dataapi', [...tokenAkun(), 'X-Request-Id' => 'nuxt-req-12345'])->assertOk();

    expect($r->headers->get('X-Request-Id'))->toBe('nuxt-req-12345');
    Http::assertSent(fn (Request $req) => $req->header('X-Request-Id') === ['nuxt-req-12345']
        && $req->header('Authorization') === ['Bearer token-uji']);
});

it('membuat request id baru bila tidak ada atau formatnya tidak aman', function () {
    Http::fake(['data-api.test/*' => Http::response('{"data":null,"meta":{}}')]);

    $tanpa = $this->getJson('/api/v1/uji/dataapi', tokenAkun())->headers->get('X-Request-Id');
    $aneh = $this->getJson('/api/v1/uji/dataapi', [...tokenAkun(), 'X-Request-Id' => "x\r\ninjeksi"])->headers->get('X-Request-Id');

    expect($tanpa)->toMatch('/^[0-9a-f-]{36}$/')
        ->and($aneh)->toMatch('/^[0-9a-f-]{36}$/');
});
