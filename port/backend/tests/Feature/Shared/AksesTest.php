<?php

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    daftarkanRuteUji();
    Http::fake(['data-api.test/*' => Http::response('{"data":{},"meta":{}}')]);
});

it('menolak tanpa token (401)', function () {
    $this->getJson('/api/v1/uji/dataapi')
        ->assertUnauthorized()
        ->assertJson(['success' => false, 'errors' => ['code' => 'UNAUTHORIZED']]);
});

it('menolak token dengan ability yang salah (403)', function () {
    $this->getJson('/api/v1/uji/admin', tokenAkun('frontend', 'read'))
        ->assertForbidden()
        ->assertJson(['errors' => ['code' => 'FORBIDDEN']]);

    // Guard menyimpan user antar-request dalam satu tes; di produksi tiap request bersih.
    app('auth')->forgetGuards();
    $this->getJson('/api/v1/uji/admin', tokenAkun('admin', 'admin'))->assertOk();
});

it('membatasi laju per klien + IP (429)', function () {
    config(['portal.batas_per_menit' => 2]);
    $token = tokenAkun();

    $this->getJson('/api/v1/uji/dataapi', $token)->assertOk();
    $this->getJson('/api/v1/uji/dataapi', $token)->assertOk();
    $this->getJson('/api/v1/uji/dataapi', $token)
        ->assertStatus(429)
        ->assertJson(['errors' => ['code' => 'TOO_MANY_REQUESTS']]);
});

it('menolak PATCH secara global, termasuk ke alamat yang tidak ada (405)', function () {
    foreach (['/api/v1/sistem/kesehatan', '/api/v1/tidak-ada', '/'] as $alamat) {
        $this->patchJson($alamat)
            ->assertStatus(405)
            ->assertJson(['success' => false, 'errors' => ['code' => 'METHOD_NOT_ALLOWED']]);
    }
});

it('tidak punya satu pun rute PATCH', function () {
    $patch = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($r) => in_array('PATCH', $r->methods(), true))
        ->map(fn ($r) => $r->uri());

    expect($patch->all())->toBe([]);
});
