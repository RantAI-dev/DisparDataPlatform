<?php

namespace App\Features\Dashboard\Http\Requests;

final class DestinasiBulananRequest extends DashboardRequest
{
    public function rules(): array
    {
        return [
            // Jenis pengunjung: wisnus atau wisman.
            'jenis' => ['required', 'in:wisnus,wisman'],
            // Nama destinasi; kosong = semua.
            'destinasi' => ['nullable', 'string', 'max:200'],
        ];
    }
}
