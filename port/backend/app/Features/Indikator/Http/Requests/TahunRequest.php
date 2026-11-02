<?php

namespace App\Features\Indikator\Http\Requests;

final class TahunRequest extends IndikatorRequest
{
    public function rules(): array
    {
        return [
            // Tahun, `YYYY`; kosong = semua tahun.
            'tahun' => ['nullable', 'string', 'regex:/^\\d{4}$/'],
        ];
    }
}
