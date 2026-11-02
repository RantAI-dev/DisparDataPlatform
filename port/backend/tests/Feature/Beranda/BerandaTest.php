<?php

use App\Shared\DataApi\JsonMentah;

/* Skenario backend beranda (docs/skenario/dataset.md, BR-B*). */

it('BR-B01 ringkasan beranda diteruskan, lalu dibaca dari snapshot', function () {
    $dipanggil = dataApiDariFixture();

    $pertama = $this->getJson('/api/v1/beranda/ringkasan', tokenAkun())->assertOk();
    $kedua = $this->getJson('/api/v1/beranda/ringkasan', tokenAkun())->assertOk();

    expect($pertama->json('data.indikator.total'))->toBe(28)
        ->and($pertama->json('meta.sumber'))->toBe('data_api')
        ->and($kedua->json('meta.sumber'))->toBe('snapshot')
        ->and(JsonMentah::nilaiMentah($kedua->getContent(), 'data'))->toBe(JsonMentah::nilaiMentah($pertama->getContent(), 'data'))
        ->and(count($dipanggil))->toBe(1);
});
