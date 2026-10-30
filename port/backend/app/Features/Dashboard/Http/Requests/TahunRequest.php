<?php

namespace App\Features\Dashboard\Http\Requests;

final class TahunRequest extends DashboardRequest
{
    public function rules(): array
    {
        return [
            // Tahun, `YYYY`; bawaan tahun terakhir.
            'tahun' => ['nullable', 'string', 'regex:/^\d{4}$/'],
        ];
    }
}
