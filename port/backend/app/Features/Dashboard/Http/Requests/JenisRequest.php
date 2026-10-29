<?php

namespace App\Features\Dashboard\Http\Requests;

final class JenisRequest extends DashboardRequest
{
    public function rules(): array
    {
        return [
            // Jenis pengunjung: wisnus atau wisman.
            'jenis' => ['required', 'in:wisnus,wisman'],
        ];
    }
}
