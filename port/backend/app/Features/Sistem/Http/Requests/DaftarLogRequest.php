<?php

namespace App\Features\Sistem\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class DaftarLogRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Nama modul (atribut rute), mis. `dataset`, `dashboard`, `sistem`.
            'modul' => ['nullable', 'string', 'max:50'],
            // Hari pertama (WIB), YYYY-MM-DD, inklusif.
            'dari' => ['nullable', 'date_format:Y-m-d'],
            // Hari terakhir (WIB), YYYY-MM-DD, inklusif.
            'sampai' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:dari'],
            // Nomor halaman, mulai 1; 50 baris per halaman, terbaru lebih dulu.
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
