<?php

use App\Shared\DataApi\SnapshotStore;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => daftarkanRuteUji());

it('mengirim snapshot bila ada, tanpa memanggil Data API', function () {
    app(SnapshotStore::class)->simpan('uji:tetap', '{"data":{"dari":"snapshot"},"meta":{"total":1}}');
    Http::fake();

    $this->getJson('/api/v1/uji/tetap', tokenAkun())
        ->assertOk()
        ->assertJson(['data' => ['dari' => 'snapshot'], 'meta' => ['sumber' => 'snapshot', 'stale' => false, 'total' => 1]]);
    Http::assertNothingSent();
});

it('menandai snapshot basi (lebih dari 36 jam)', function () {
    app(SnapshotStore::class)->simpan('uji:tetap', '{"data":1,"meta":{}}');
    DB::table('snapshot')->update(['diambil_pada' => CarbonImmutable::now()->subHours(37)]);

    $this->getJson('/api/v1/uji/tetap', tokenAkun())->assertOk()->assertJson(['meta' => ['sumber' => 'snapshot', 'stale' => true]]);
});

it('mengisi snapshot dari Data API bila kosong', function () {
    Http::fake(['data-api.test/*' => Http::response('{"data":{"kosong":{}},"meta":{"total":0}}')]);

    $this->getJson('/api/v1/uji/tetap', tokenAkun())->assertOk()->assertJson(['meta' => ['sumber' => 'data_api', 'stale' => false]]);

    $isi = DB::table('snapshot')->where('kunci', 'uji:tetap')->value('isi');
    expect($isi)->toBe('{"data":{"kosong":{}},"meta":{"total":0}}');
});

it('menjawab 503 bila snapshot kosong dan Data API mati', function () {
    Http::fake(fn () => throw new ConnectionException('mati'));

    $this->getJson('/api/v1/uji/tetap', tokenAkun())->assertStatus(503)->assertJson(['errors' => ['code' => 'UPSTREAM_UNAVAILABLE']]);
    expect(DB::table('snapshot')->count())->toBe(0);
});

it('tetap menjawab bila request lain mengisi snapshot yang sama lebih dulu (rebutan)', function () {
    Http::fake(['data-api.test/*' => Http::response('{"data":{"menang":"saya"},"meta":{}}')]);
    // Tepat sebelum INSERT, "request lain" menyisipkan kunci yang sama.
    $sudah = false;
    DB::beforeExecuting(function (string $sql) use (&$sudah) {
        if (! $sudah && str_starts_with(strtolower($sql), 'insert into "snapshot"')) {
            $sudah = true;
            DB::table('snapshot')->insert([
                'kunci' => 'uji:tetap', 'isi' => '{"data":1,"meta":{}}', 'diambil_pada' => now(), 'hash' => 'x',
            ]);
        }
    });

    $this->getJson('/api/v1/uji/tetap', tokenAkun())->assertOk()->assertJson(['data' => ['menang' => 'saya']]);
    expect($sudah)->toBeTrue()
        ->and(DB::table('snapshot')->where('kunci', 'uji:tetap')->value('isi'))->toBe('{"data":{"menang":"saya"},"meta":{}}');
});
