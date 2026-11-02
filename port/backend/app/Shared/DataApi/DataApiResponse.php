<?php

namespace App\Shared\DataApi;

use stdClass;

/** Respons sukses Data API. `data` tetap string JSON mentah (SPEC §4.4). */
final class DataApiResponse
{
    public function __construct(
        public readonly string $data,
        public readonly stdClass $meta,
    ) {}

    /** Body lengkap `{"data":…,"meta":…}` mentah, untuk disimpan di snapshot/cache. */
    public function body(): string
    {
        return '{"data":'.$this->data.',"meta":'.JsonMentah::encode($this->meta).'}';
    }

    public static function dariBody(string $body): self
    {
        $o = JsonMentah::decode($body); // validasi + meta
        $meta = isset($o->meta) && $o->meta instanceof stdClass ? $o->meta : new stdClass;

        // `data` diambil mentah dari body, bukan di-encode ulang (presisi UInt64, bentuk tetap).
        return new self(JsonMentah::nilaiMentah($body, 'data') ?? 'null', $meta);
    }
}
