<?php

namespace App\Features\Gmti\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class TempatRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Nomor halaman, mulai 1.
            'page' => ['nullable', 'integer', 'min:1'],
            // Baris per halaman (maks. 200).
            'size' => ['nullable', 'integer', 'min:1', 'max:200'],
            // Pilar GMTI; `semua` = tanpa filter.
            'pilar' => ['nullable', 'in:semua,ibadah,makan,menginap,destinasi,program'],
            // Kota administrasi; kosong = semua kota.
            'kota' => ['nullable', 'string', 'max:100'],
            // Jenis tempat dalam pilar; kosong = semua jenis.
            'jenis' => ['nullable', 'string', 'max:100'],
            // Cari nama atau alamat.
            'q' => ['nullable', 'string', 'max:200'],
        ];
    }
}
