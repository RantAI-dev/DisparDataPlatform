<?php

namespace App\Shared\Cache;

use Closure;
use Illuminate\Cache\DatabaseStore;
use Illuminate\Database\QueryException;

/**
 * Store cache `database` untuk Oracle. Dua bagian DatabaseStore bawaan gagal di Oracle, dan
 * keduanya dipakai RateLimiter di setiap request ber-throttle:
 *
 * - add() memakai `insertOrIgnore`, yang tidak didukung grammar yajra. Diganti jalur SQL Server
 *   milik Laravel: insert biasa; kunci yang sudah ada (ORA-00001) berarti gagal menambah.
 * - increment()/decrement() memakai `lockForUpdate()->first()`, yang di Oracle menjadi
 *   `FETCH FIRST … FOR UPDATE` (ORA-02014). Kunci adalah primary key, jadi baris dikunci tanpa
 *   batas baris lalu diambil yang pertama.
 */
final class OracleDatabaseStore extends DatabaseStore
{
    public function add($key, $value, $seconds)
    {
        if (! is_null($this->get($key))) {
            return false;
        }

        try {
            return $this->table()->insert([
                'key' => $this->prefix.$key,
                'value' => $this->serialize($value),
                'expiration' => $this->getTime() + $seconds,
            ]);
        } catch (QueryException $e) {
            if (str_contains($e->getMessage(), 'ORA-00001')) {
                return false;
            }
            throw $e;
        }
    }

    protected function incrementOrDecrement($key, $value, Closure $callback)
    {
        return $this->connection->transaction(function () use ($key, $value, $callback) {
            $prefixed = $this->prefix.$key;
            $cache = $this->table()->where('key', $prefixed)->lockForUpdate()->get()->first();
            if (is_null($cache)) {
                return false;
            }

            $current = $this->unserialize(((object) $cache)->value);
            if (! is_numeric($current)) {
                return false;
            }
            $baru = $callback((int) $current, $value);
            $this->table()->where('key', $prefixed)->update(['value' => $this->serialize($baru)]);

            return $baru;
        });
    }
}
