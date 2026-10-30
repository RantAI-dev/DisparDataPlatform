<?php

namespace App\Features\Dashboard\Http\Requests;

final class DestinasiTahunRequest extends DashboardRequest
{
    public function rules(): array
    {
        return [
            // Jenis pengunjung: wisnus atau wisman.
            'jenis' => ['required', 'in:wisnus,wisman'],
            // Tahun, `YYYY`.
            'tahun' => ['nullable', 'string', 'regex:/^\d{4}$/'],
        ];
    }
}
