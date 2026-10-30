<?php

namespace App\Features\Dashboard\Http\Requests;

final class PintuMasukRequest extends DashboardRequest
{
    public function rules(): array
    {
        return [
            // Tahun, `YYYY`.
            'tahun' => ['nullable', 'string', 'regex:/^\d{4}$/'],
            // Bulan, `YYYY-MM` (menggantikan tahun).
            'periode' => ['nullable', 'string', 'regex:/^\d{4}-\d{2}$/'],
        ];
    }
}
