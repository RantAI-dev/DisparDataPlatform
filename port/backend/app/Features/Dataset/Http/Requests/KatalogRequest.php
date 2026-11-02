<?php

namespace App\Features\Dataset\Http\Requests;

final class KatalogRequest extends DatasetRequest
{
    public function rules(): array
    {
        return [
            // Tier dataset: semua (bawaan), primer (Satu Data Jakarta), atau sekunder.
            'tier' => ['nullable', 'in:semua,primer,sekunder'],
            // Sumber data: sdi, internal, instansi, atau crawling; semua = tanpa saringan.
            'sumber' => ['nullable', 'in:semua,sdi,internal,instansi,crawling'],
            // Hanya dataset dengan tag ini.
            'tag' => ['nullable', 'string', 'max:100'],
            // Nomor halaman, mulai 1.
            'page' => ['nullable', 'integer', 'min:1'],
            // Jumlah baris per halaman.
            'size' => ['nullable', 'integer', 'min:1', 'max:500'],
        ];
    }
}
