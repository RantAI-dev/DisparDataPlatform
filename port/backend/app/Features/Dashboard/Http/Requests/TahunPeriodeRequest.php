<?php

namespace App\Features\Dashboard\Http\Requests;

final class TahunPeriodeRequest extends DashboardRequest
{
    public function rules(): array
    {
        return [
            // Tahun, `YYYY`.
            'tahun' => ['nullable', 'string', 'regex:/^\d{4}$/'],
            // Bulan, `YYYY-MM` (menggantikan tahun).
            'periode' => ['nullable', 'string', 'regex:/^\d{4}-\d{2}$/'],
            // Jumlah kategori teratas sebelum Lainnya.
            'top' => ['nullable', 'integer', 'min:1', 'max:50'],
        ];
    }
}
