<?php

namespace App\Features\Dataset\Http\Requests;

final class BarisRequest extends DatasetRequest
{
    public function rules(): array
    {
        return [
            // Nomor halaman, mulai 1.
            'page' => ['nullable', 'integer', 'min:1'],
            // Jumlah baris per halaman.
            'size' => ['nullable', 'integer', 'min:1', 'max:200'],
            // Urutan satu kolom: `kolom:asc` atau `kolom:desc`.
            'sort' => self::SORT,
            // Cari teks di semua kolom.
            'q' => self::Q,
            'f' => self::F,
            // Filter, diulang: `kolom:in:nilai` (ulangi untuk nilai lain) atau `kolom:range:min..max`.
            'f.*' => ['string', 'max:500'],
        ];
    }
}
