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
 * - put() memakai `upsert` (MERGE … USING (SELECT :bind FROM dual)); nilai > 32 KB di bind itu
 *   gagal dengan ORA-01461 (respons Data API besar, plan 13). Diganti update lalu insert, yang
 *   mengikat nilai sebagai CLOB seperti tabel SNAPSHOT.
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

    public function put($key, $value, $seconds)
    {
        $nilai = ['value' => $this->serialize($value), 'expiration' => $this->getTime() + $seconds];
        $kunci = $this->prefix.$key;
        if ($this->table()->where('key', $kunci)->update($nilai) > 0) {
            return true;
        }

        try {
            return $this->table()->insert(['key' => $kunci, ...$nilai]);
        } catch (QueryException $e) {
            // Request lain menulis kunci yang sama di antara update dan insert: timpa saja.
            if (! str_contains($e->getMessage(), 'ORA-00001')) {
                throw $e;
            }

            return $this->table()->where('key', $kunci)->update($nilai) > 0;
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
