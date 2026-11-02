<?php

namespace App\Features\Dataset\Http\Requests;

final class HalamanRequest extends DatasetRequest
{
    public function rules(): array
    {
        return [
            // Nomor halaman, mulai 1.
            'page' => ['nullable', 'integer', 'min:1'],
            // Jumlah baris per halaman.
            'size' => ['nullable', 'integer', 'min:1', 'max:200'],
        ];
    }
}
