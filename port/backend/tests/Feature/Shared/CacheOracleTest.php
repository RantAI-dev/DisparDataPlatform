<?php

use Illuminate\Support\Facades\Cache;

/*
| Cache `database` di Oracle (SPEC §4.6). Tes lain memakai store array, jadi bagian ini menguji
| store Oracle secara langsung, termasuk throttle:api yang memanggil add() di setiap request.
*/

it('add() hanya berhasil sekali per kunci dan bisa dibaca kembali', function () {
    $cache = Cache::store('database');

    expect($cache->add('uji:kunci', ['a' => 1], 60))->toBeTrue()
        ->and($cache->add('uji:kunci', ['a' => 2], 60))->toBeFalse()
        ->and($cache->get('uji:kunci'))->toBe(['a' => 1]);
});

it('increment() bekerja di Oracle (tanpa FETCH FIRST … FOR UPDATE)', function () {
    $cache = Cache::store('database');
    $cache->put('uji:hitung', 1, 60);

    expect($cache->increment('uji:hitung'))->toBe(2)
        ->and($cache->increment('uji:hitung', 3))->toBe(5)
        ->and($cache->decrement('uji:hitung'))->toBe(4)
        ->and($cache->increment('uji:tidak-ada'))->toBeFalse();
});
