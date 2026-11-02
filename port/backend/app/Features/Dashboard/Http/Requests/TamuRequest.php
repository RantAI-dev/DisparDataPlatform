<?php

namespace App\Features\Dashboard\Http\Requests;

final class TamuRequest extends DashboardRequest
{
    public function rules(): array
    {
        return [
            // Jenis tamu: wisman atau wisnus.
            'tamu' => ['required', 'in:wisman,wisnus'],
            // Bulan, `YYYY-MM`; bawaan bulan terakhir.
            'periode' => ['nullable', 'string', 'regex:/^\d{4}-\d{2}$/'],
        ];
    }
}
