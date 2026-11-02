<?php

use App\Shared\DataApi\JsonMentah;
use App\Shared\LogHistory\LogHistory;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Http;

/*
| Skenario backend fitur dataset (docs/skenario/dataset.md, DS-B*). Data API dipalsukan dengan
| rekaman fixtures/data-api; rute dan jalur Shared yang dipakai adalah yang sesungguhnya.
*/

const S1 = 'data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan';

/** Body Data API yang terekam untuk sebuah kunci. */
function bodyFixture(string $kunci): string
{
    foreach (glob(dirname(__DIR__, 3).'/../fixtures/data-api/*.json') as $berkas) {
        $r = json_decode(file_get_contents($berkas), true);
        if ($r['kunci'] === $kunci) {
            return $r['body'];
        }
    }
    throw new RuntimeException("fixture $kunci tidak ada");
}

beforeEach(function () {
    $this->dipanggil = dataApiDariFixture();
});

it('DS-B01 katalog diteruskan dengan data byte-identik dan meta Data API', function (string $tier) {
    $res = $this->getJson("/api/v1/katalog?tier=$tier", tokenAkun())->assertOk();

    $asal = bodyFixture("/v1/katalog?tier=$tier");
    expect(JsonMentah::nilaiMentah($res->getContent(), 'data'))->toBe(JsonMentah::nilaiMentah($asal, 'data'))
        ->and($res->json('meta.source'))->toBe(json_decode($asal)->meta->source)
        ->and($res->json('meta.sumber'))->toBe('data_api');
})->with(['semua', 'primer']);

it('DS-B02 katalog kelas T dibaca dari snapshot pada request berikutnya', function () {
    $this->getJson('/api/v1/katalog?tier=primer', tokenAkun())->assertOk();
    $res = $this->getJson('/api/v1/katalog?tier=primer', tokenAkun())->assertOk();

    expect($res->json('meta.sumber'))->toBe('snapshot')
        ->and($this->dipanggil->getArrayCopy())->toBe(['/v1/katalog?tier=primer']);
});

it('DS-B03 detail dataset diteruskan; slug tak dikenal 404 dalam envelope', function () {
    $this->getJson('/api/v1/dataset/'.S1, tokenAkun())
        ->assertOk()
        ->assertJsonPath('data.slug', S1)
        ->assertJsonPath('data.medallion.level', 'silver');

    $this->getJson('/api/v1/dataset/tidak-ada', tokenAkun())
        ->assertNotFound()
        ->assertJson(['success' => false, 'errors' => ['code' => 'NOT_FOUND']]);
});

it('DS-B04 baris meneruskan page, size, q, sort, dan f[] sebagai f= berulang', function () {
    $this->getJson('/api/v1/dataset/'.S1.'/baris?page=1&size=50&q=JEPANG', tokenAkun())
        ->assertOk()->assertJsonPath('meta.total', 31);
    $this->getJson('/api/v1/dataset/'.S1.'/baris?page=1&size=50&sort=jumlah_kunjungan:desc', tokenAkun())->assertOk();
    $this->getJson('/api/v1/dataset/penerbangan-langsung-internasional-jakarta/baris?size=20&sort=maskapai:asc&f[]=negara:in:Jepang&f[]=negara:in:Singapura', tokenAkun())
        ->assertOk();

    expect($this->dipanggil->getArrayCopy())->toBe([
        '/v1/dataset/'.S1.'/baris?page=1&q=JEPANG&size=50',
        '/v1/dataset/'.S1.'/baris?page=1&size=50&sort=jumlah_kunjungan%3Adesc',
        '/v1/dataset/penerbangan-langsung-internasional-jakarta/baris?f=negara%3Ain%3AJepang&f=negara%3Ain%3ASingapura&size=20&sort=maskapai%3Aasc',
    ]);
    Http::assertSent(fn ($req) => substr_count($req->url(), 'f=negara') === 2 && ! str_contains($req->url(), 'f%5B'));
});

it('DS-B05 baris kelas P dibaca dari cache pada request berikutnya', function () {
    $url = '/api/v1/dataset/'.S1.'/baris?page=2&size=50';
    $pertama = $this->getJson($url, tokenAkun())->assertOk();
    $kedua = $this->getJson($url, tokenAkun())->assertOk();

    expect($pertama->json('meta.sumber'))->toBe('data_api')
        ->and($kedua->json('meta.sumber'))->toBe('cache')
        ->and(JsonMentah::nilaiMentah($kedua->getContent(), 'data'))->toBe(JsonMentah::nilaiMentah($pertama->getContent(), 'data'))
        ->and(count($this->dipanggil))->toBe(1);
});

it('DS-B06 filter tak valid: 400 Data API diteruskan dan tidak di-cache', function () {
    $url = '/api/v1/dataset/'.S1.'/baris?page=1&size=50&f[]=kolom_palsu:in:x';
    $this->getJson($url, tokenAkun())->assertStatus(400)->assertJsonPath('errors.code', 'INVALID_FILTER');
    $this->getJson($url, tokenAkun())->assertStatus(400);

    expect(count($this->dipanggil))->toBe(2);
});

it('DS-B07 parameter yang melanggar kontrak ditolak 422 tanpa memanggil Data API', function (string $alamat) {
    $this->getJson('/api/v1/dataset/'.S1.$alamat, tokenAkun())
        ->assertStatus(422)
        ->assertJsonPath('errors.code', 'INVALID_PARAM');

    expect(count($this->dipanggil))->toBe(0);
})->with([
    'size > 200' => ['/baris?size=500'],
    'sort tanpa arah' => ['/baris?sort=jumlah_kunjungan'],
    'agg tak dikenal' => ['/agregat?x=kebangsaan&agg=median'],
    'agregat tanpa x' => ['/agregat?agg=count'],
    'format ekspor' => ['/ekspor?format=pdf'],
]);

it('DS-B08 halaman menggabung detail, kolom, dan baris pertama dalam satu request', function () {
    $res = $this->getJson('/api/v1/dataset/'.S1.'/halaman?page=1&size=50', tokenAkun())->assertOk();

    expect(JsonMentah::nilaiMentah($res->getContent(), 'data'))->toBe(
        '{"dataset":'.JsonMentah::nilaiMentah(bodyFixture('/v1/dataset/'.S1), 'data')
        .',"kolom":'.JsonMentah::nilaiMentah(bodyFixture('/v1/dataset/'.S1.'/kolom'), 'data')
        .',"baris":'.JsonMentah::nilaiMentah(bodyFixture('/v1/dataset/'.S1.'/baris?page=1&size=50'), 'data').'}'
    );
    $baris = json_decode(bodyFixture('/v1/dataset/'.S1.'/baris?page=1&size=50'));
    expect($res->json('meta.total'))->toBe($baris->meta->total)
        ->and($res->json('meta.has_more'))->toBeTrue()
        ->and($res->json('data.dataset.total_bronze'))->toBeInt()
        ->and($res->json('meta.source'))->toContain('silver.<tabel>');
});

it('DS-B08 halaman slug tak dikenal → 404 tanpa memanggil kolom dan baris', function () {
    $this->getJson('/api/v1/dataset/tidak-ada/halaman', tokenAkun())->assertNotFound();

    expect($this->dipanggil->getArrayCopy())->toBe(['/v1/dataset/tidak-ada']);
});

it('DS-B09 facet dan agregat diteruskan, agregat membawa filter', function () {
    $this->getJson('/api/v1/dataset/'.S1.'/facet', tokenAkun())->assertOk()->assertJsonPath('data.items.0.key', 'periode_data');
    $this->getJson('/api/v1/dataset/'.S1.'/agregat?x=kebangsaan&y=jumlah_kunjungan&agg=sum&f[]=kebangsaan:in:JEPANG', tokenAkun())
        ->assertOk()
        ->assertJsonCount(1, 'data.items');
});

it('DS-B10 ekspor dialirkan apa adanya dan dicatat bersama filternya', function () {
    $res = $this->get('/api/v1/dataset/'.S1.'/ekspor?format=csv&f[]=kebangsaan:in:JEPANG', tokenAkun())->assertOk();
    $isi = $res->streamedContent();
    $asal = bodyFixture('/v1/dataset/'.S1.'/ekspor?f=kebangsaan%3Ain%3AJEPANG&format=csv');

    expect($isi)->toBe($asal)
        ->and(str_starts_with($isi, "\u{FEFF}"))->toBeTrue()
        ->and($res->headers->get('Content-Disposition'))->toBe('attachment; filename="'.S1.'-terfilter.csv"')
        ->and($res->headers->get('Content-Type'))->toStartWith('text/csv')
        ->and($res->headers->get('X-Row-Count'))->toBe('31')
        ->and($res->headers->get('X-Accel-Buffering'))->toBe('no');

    $log = LogHistory::sole();
    expect($log->modul)->toBe('dataset')
        ->and($log->aksi)->toBe('dataset.ekspor')
        ->and((int) $log->jumlah_baris)->toBe(31)
        ->and($log->sumber)->toBe('data_api')
        ->and($log->param_ringkas)->toBe('{"f":["kebangsaan:in:JEPANG"],"format":"csv"}');
});

it('DS-B11 ekspor di atas batas: 413 TOO_LARGE diteruskan dalam envelope', function () {
    Http::swap(new Factory); // ganti pemutar fixture dari beforeEach
    Http::fake(['data-api.test/*' => Http::response('{"error":{"code":"TOO_LARGE","message":"Ekspor maksimal 100.000 baris","detail":null}}', 413)]);

    $this->getJson('/api/v1/dataset/'.S1.'/ekspor?format=csv', tokenAkun())
        ->assertStatus(413)
        ->assertJson(['success' => false, 'errors' => ['code' => 'TOO_LARGE']]);
});

it('DS-B12 Data API mati → 503 envelope, baik kelas P maupun T tanpa snapshot', function (string $alamat) {
    Http::swap(new Factory);
    Http::fake(fn () => throw new ConnectionException('mati'));

    $this->getJson($alamat, tokenAkun())
        ->assertStatus(503)
        ->assertJson(['success' => false, 'errors' => ['code' => 'UPSTREAM_UNAVAILABLE']]);
})->with(['/api/v1/katalog', '/api/v1/dataset/'.S1.'/baris', '/api/v1/dataset/'.S1.'/halaman']);

it('DS-B13 setiap rute dataset tercatat di LOG_HISTORY dengan modul, aksi, dan sumber', function () {
    $r = $this->getJson('/api/v1/dataset/'.S1.'/baris?page=1&size=50&q=JEPANG', tokenAkun())->assertOk();
    $this->getJson('/api/v1/dataset/'.S1.'/baris?page=1&size=50&q=JEPANG', tokenAkun())->assertOk();

    $log = LogHistory::orderBy('id')->get();
    expect($log)->toHaveCount(2)
        ->and($log[0]->request_id)->toBe($r->json('meta.request_id'))
        ->and($log[0]->modul)->toBe('dataset')
        ->and($log[0]->aksi)->toBe('dataset.baris')
        ->and((int) $log[0]->jumlah_baris)->toBe(31)
        ->and([$log[0]->sumber, $log[1]->sumber])->toBe(['data_api', 'cache']);
});

it('DS-B14 rute dataset wajib token ability read', function () {
    $this->getJson('/api/v1/katalog')->assertUnauthorized();
    $this->getJson('/api/v1/dataset/'.S1.'/halaman')->assertUnauthorized();
});
