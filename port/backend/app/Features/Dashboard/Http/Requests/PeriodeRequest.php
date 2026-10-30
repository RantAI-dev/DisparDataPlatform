<?php

namespace App\Features\Dashboard\Http\Requests;

final class PeriodeRequest extends DashboardRequest
{
    public function rules(): array
    {
        return [
            // Bulan terpilih, `YYYY-MM`.
            'periode' => ['nullable', 'string', 'regex:/^\d{4}-\d{2}$/'],
        ];
    }
}
