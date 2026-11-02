<?php

use Illuminate\Support\Facades\Http;

beforeEach(fn () => daftarkanRuteUji());

it('membungkus data Data API dalam envelope sukses', function () {
    Http::fake(['data-api.test/v1/uji*' => Http::response(
        '{"data":{"a":1},"meta":{"generated_at":"2026-10-28T10:00:00Z","source":["serving.mart_x"],"total":7}}'
    )]);

    $r = $this->getJson('/api/v1/uji/dataapi', tokenAkun());

    $r->assertOk()->assertJson([
        'success' => true,
        'message' => 'OK',
        'data' => ['a' => 1],
        'meta' => ['source' => ['serving.mart_x'], 'total' => 7, 'sumber' => 'data_api', 'stale' => false],
    ]);
    expect($r->json('meta.request_id'))->toBe($r->headers->get('X-Request-Id'));
});

it('meneruskan data tanpa mengubah bentuk: {} kosong, map berkunci "0", dan 1.0', function () {
    $data = '{"kosong":{},"daftar":[],"peta":{"0":"a","1":"b"},"desimal":1.0,"teks":"Jakarta/Ancol – é","nol":0}';
    Http::fake(['data-api.test/v1/uji*' => Http::response('{"data":'.$data.',"meta":{}}')]);

    $body = $this->getJson('/api/v1/uji/dataapi', tokenAkun())->assertOk()->getContent();

    expect($body)->toContain('"data":'.$data.',"meta":');
});

it('meneruskan status dan kode error Data API dalam envelope gagal', function () {
    Http::fake(['data-api.test/v1/uji*' => Http::response(
        '{"error":{"code":"INVALID_FILTER","message":"filter salah","detail":{"f":"x"}}}', 400
    )]);

    $this->getJson('/api/v1/uji/dataapi', tokenAkun())
        ->assertStatus(400)
        ->assertJson(['success' => false, 'message' => 'Filter tidak valid.', 'errors' => ['code' => 'INVALID_FILTER']])
        ->assertJsonStructure(['meta' => ['request_id']]);
});

it('menjawab 404 berbentuk envelope untuk alamat yang tidak ada', function () {
    $this->getJson('/api/v1/tidak-ada')
        ->assertNotFound()
        ->assertJson(['success' => false, 'errors' => ['code' => 'NOT_FOUND']]);
});

it('menjawab 422 dengan errors.fields untuk parameter yang tidak valid', function () {
    $this->getJson('/api/v1/uji/validasi?page=abc', tokenAkun())
        ->assertStatus(422)
        ->assertJson(['success' => false, 'message' => 'Parameter tidak valid.', 'errors' => ['code' => 'INVALID_PARAM']])
        ->assertJsonStructure(['errors' => ['fields' => ['page']], 'meta' => ['request_id']]);
});

it('meneruskan data mentah: UInt64 di atas PHP_INT_MAX dan teks berisi kurung/kutip', function () {
    $data = '{"id":18446744073709551615,"teks":"a\\"}b]","daftar":[1,{"x":"]"}],"spasi" : [ 1 , 2 ]}';
    Http::fake(['data-api.test/v1/uji*' => Http::response('{"meta":{"total":1},"data":'.$data.'}')]);

    $body = $this->getJson('/api/v1/uji/dataapi', tokenAkun())->assertOk()->getContent();

    expect($body)->toContain('"data":'.$data.',"meta":');
});
