<?php

namespace App\Features\Dashboard\Http\Requests;

final class DestinasiRequest extends DashboardRequest
{
    public function rules(): array
    {
        return [
            // Jenis pengunjung: wisnus atau wisman.
            'jenis' => ['required', 'in:wisnus,wisman'],
            // Tahun, `YYYY`.
            'tahun' => ['nullable', 'string', 'regex:/^\d{4}$/'],
            // Nama destinasi; kosong = semua.
            'destinasi' => ['nullable', 'string', 'max:200'],
        ];
    }
}
