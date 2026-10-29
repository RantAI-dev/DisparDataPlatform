<?php

namespace App\Features\Dataset\Http\Requests;

final class KatalogRequest extends DatasetRequest
{
    public function rules(): array
    {
        return [
            'tier' => ['nullable', 'in:semua,primer,sekunder'],
            'sumber' => ['nullable', 'in:semua,sdi,internal,instansi,crawling'],
            'tag' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
            'size' => ['nullable', 'integer', 'min:1', 'max:500'],
        ];
    }
}
