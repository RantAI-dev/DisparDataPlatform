<?php

use App\Shared\LogHistory\LogHistory;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

beforeEach(function () {
    daftarkanRuteUji();
    Http::fake(['data-api.test/*' => Http::response('{"data":[1,2],"meta":{"total":2}}')]);
});

it('menulis satu baris LOG_HISTORY per request', function () {
    $r = $this->getJson('/api/v1/uji/dataapi?f[]=a&token=rahasia', [...tokenAkun(), 'User-Agent' => 'nuxt-uji'])->assertOk();

    expect(LogHistory::count())->toBe(1);
    $log = LogHistory::first();
    expect($log->request_id)->toBe($r->headers->get('X-Request-Id'))
        ->and($log->modul)->toBe('uji')
        ->and($log->aksi)->toBe('uji.dataapi')
        ->and($log->metode)->toBe('GET')
        ->and($log->path)->toBe('/api/v1/uji/dataapi')
        ->and($log->klien)->toBe('frontend')
        ->and($log->user_agent)->toBe('nuxt-uji')
        ->and((int) $log->status_http)->toBe(200)
        ->and((int) $log->jumlah_baris)->toBe(2)
        ->and($log->sumber)->toBe('data_api')
        ->and($log->param_hash)->toHaveLength(64)
        ->and($log->param_ringkas)->toBe('{"f":["a"]}');
});

it('mencatat request yang gagal juga', function () {
    $this->getJson('/api/v1/uji/dataapi')->assertUnauthorized();

    expect((int) LogHistory::first()->status_http)->toBe(401);
});

it('memakai IP asli dari X-Forwarded-For hanya bila datang dari proxy tepercaya', function () {
    config(['portal.proxy_tepercaya' => ['10.1.1.1']]);
    $token = tokenAkun();

    $this->withServerVariables(['REMOTE_ADDR' => '10.1.1.1'])
        ->getJson('/api/v1/uji/dataapi', [...$token, 'X-Forwarded-For' => '203.0.113.9'])->assertOk();
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.7'])
        ->getJson('/api/v1/uji/dataapi', [...$token, 'X-Forwarded-For' => '203.0.113.9'])->assertOk();

    expect(LogHistory::orderBy('id')->pluck('ip')->all())->toBe(['203.0.113.9', '198.51.100.7']);
});

it('tidak menggagalkan respons bila log gagal ditulis', function () {
    Log::spy();
    LogHistory::creating(fn () => throw new RuntimeException('Oracle penuh'));

    $this->getJson('/api/v1/uji/dataapi', tokenAkun())->assertOk();

    Log::shouldHaveReceived('warning')->withArgs(fn ($pesan) => $pesan === 'log_history gagal ditulis')->once();
});

it('memotong teks per byte supaya teks non-ASCII yang panjang tetap tercatat', function () {
    config(['loghistory.param_maks' => 2000]);
    $cari = str_repeat('é–', 900); // 1.800 karakter, 4.500 byte

    $this->getJson('/api/v1/uji/dataapi?q='.rawurlencode($cari), tokenAkun())->assertOk();

    $ringkas = LogHistory::sole()->param_ringkas;
    expect(strlen($ringkas))->toBeLessThanOrEqual(2000)
        ->and(mb_check_encoding($ringkas, 'UTF-8'))->toBeTrue();
});
