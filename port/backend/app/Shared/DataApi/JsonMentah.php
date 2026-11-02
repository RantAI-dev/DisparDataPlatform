<?php

namespace App\Shared\DataApi;

/**
 * Decode/encode JSON tanpa mengubah bentuk (SPEC §4.4).
 *
 * Decode sebagai objek, bukan array asosiatif: `{}` tetap `{}` (bukan `[]`), map berkunci "0"
 * tetap objek, dan 1.0 tetap 1.0 saat di-encode ulang.
 */
final class JsonMentah
{
    public const FLAG = JSON_PRESERVE_ZERO_FRACTION | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

    public static function decode(string $json): mixed
    {
        return json_decode($json, false, 512, JSON_THROW_ON_ERROR);
    }

    public static function encode(mixed $nilai): string
    {
        return json_encode($nilai, self::FLAG | JSON_THROW_ON_ERROR);
    }

    /**
     * Teks mentah nilai sebuah kunci tingkat atas pada objek JSON, tanpa decode-encode.
     *
     * Dipakai untuk `data` Data API: decode lalu encode ulang membulatkan bilangan bulat di atas
     * PHP_INT_MAX (mis. UInt64 ClickHouse) menjadi float. `$json` harus sudah valid (decode dulu).
     */
    public static function nilaiMentah(string $json, string $kunci): ?string
    {
        $i = self::lewatiSpasi($json, 0);
        if (($json[$i] ?? '') !== '{') {
            return null;
        }
        $i = self::lewatiSpasi($json, $i + 1);
        while (($json[$i] ?? '}') !== '}') {
            $akhirKunci = self::akhirNilai($json, $i);
            $nama = json_decode(substr($json, $i, $akhirKunci - $i));
            $awal = self::lewatiSpasi($json, self::lewatiSpasi($json, $akhirKunci) + 1); // lewati ':'
            $akhir = self::akhirNilai($json, $awal);
            if ($nama === $kunci) {
                return substr($json, $awal, $akhir - $awal);
            }
            $i = self::lewatiSpasi($json, $akhir);
            if (($json[$i] ?? '') === ',') {
                $i = self::lewatiSpasi($json, $i + 1);
            }
        }

        return null;
    }

    private static function lewatiSpasi(string $s, int $i): int
    {
        return $i + strspn($s, " \t\r\n", $i);
    }

    /** Posisi tepat setelah satu nilai JSON (string, objek, array, atau skalar) yang mulai di $i. */
    private static function akhirNilai(string $s, int $i): int
    {
        $c = $s[$i];
        if ($c === '"') {
            for ($i++; $s[$i] !== '"'; $i++) {
                if ($s[$i] === '\\') {
                    $i++;
                }
            }

            return $i + 1;
        }
        if ($c === '{' || $c === '[') {
            for ($kedalaman = 0; ;) {
                $c = $s[$i];
                if ($c === '"') {
                    $i = self::akhirNilai($s, $i);

                    continue;
                }
                $kedalaman += match ($c) {
                    '{', '[' => 1, '}', ']' => -1, default => 0
                };
                $i++;
                if ($kedalaman === 0) {
                    return $i;
                }
            }
        }

        return $i + strcspn($s, ",}] \t\r\n", $i);
    }
}
