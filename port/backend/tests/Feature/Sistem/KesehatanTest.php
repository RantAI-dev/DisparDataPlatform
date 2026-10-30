<?php

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

it('melaporkan Oracle dan Data API ok tanpa token', function () {
    Http::fake(['data-api.test/v1/health' => Http::response('{"data":{"status":"ok"},"meta":{}}')]);

    $this->getJson('/api/v1/sistem/kesehatan')
        ->assertOk()
        ->assertJson([
            'success' => true,
            'data' => ['status' => 'ok', 'versi' => 'dev', 'komponen' => ['oracle' => 'ok', 'data_api' => 'ok']],
            'meta' => ['sumber' => null],
        ]);
});

it('melaporkan terganggu bila Data API tidak menjawab, dengan satu percobaan saja', function () {
    $percobaan = 0;
    Http::fake(function () use (&$percobaan) {
        $percobaan++;
        throw new ConnectionException('mati');
    });

    $this->getJson('/api/v1/sistem/kesehatan')
        ->assertOk()
        ->assertJson(['data' => ['status' => 'terganggu', 'komponen' => ['oracle' => 'ok', 'data_api' => 'gagal']]]);
    expect($percobaan)->toBe(1);
});
