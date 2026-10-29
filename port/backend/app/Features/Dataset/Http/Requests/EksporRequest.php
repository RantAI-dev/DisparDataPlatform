<?php

namespace App\Features\Dataset\Http\Requests;

final class EksporRequest extends DatasetRequest
{
    public function rules(): array
    {
        return [
            // Format berkas: csv (bawaan) atau xlsx.
            'format' => ['nullable', 'in:csv,xlsx'],
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
