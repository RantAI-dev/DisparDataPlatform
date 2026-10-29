<?php

namespace App\Features\Dataset\Http\Requests;

final class HalamanRequest extends DatasetRequest
{
    public function rules(): array
    {
        return [
            'page' => ['nullable', 'integer', 'min:1'],
            'size' => ['nullable', 'integer', 'min:1', 'max:200'],
        ];
    }
}
