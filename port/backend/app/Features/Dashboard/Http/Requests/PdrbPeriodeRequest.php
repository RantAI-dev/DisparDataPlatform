<?php

namespace App\Features\Dashboard\Http\Requests;

final class PdrbPeriodeRequest extends DashboardRequest
{
    public function rules(): array
    {
        return [
            // Periode PDRB, mis. `2024` atau `S1 2025`.
            'periode' => ['nullable', 'string', 'max:20'],
        ];
    }
}
