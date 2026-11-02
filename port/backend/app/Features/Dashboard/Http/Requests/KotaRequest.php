<?php

namespace App\Features\Dashboard\Http\Requests;

final class KotaRequest extends DashboardRequest
{
    public function rules(): array
    {
        return [
            // Kota tujuan; kosong = semua kota.
            'kota' => ['nullable', 'string', 'max:100'],
        ];
    }
}
