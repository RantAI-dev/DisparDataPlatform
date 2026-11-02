<?php

namespace App\Features\Dataset\Http\Requests;

final class AgregatRequest extends DatasetRequest
{
    public function rules(): array
    {
        return [
            // Kolom kategori.
            'x' => ['required', 'string', 'max:200'],
            // Kolom nilai; tidak dipakai untuk count.
            'y' => ['nullable', 'string', 'max:200'],
            // Agregasi: sum, avg, count, max, atau min.
            'agg' => ['required', 'in:sum,avg,count,max,min'],
            // Cari teks di semua kolom.
            'q' => self::Q,
            'f' => self::F,
            // Filter, diulang: `kolom:in:nilai` (ulangi untuk nilai lain) atau `kolom:range:min..max`.
            'f.*' => ['string', 'max:500'],
        ];
    }
}
