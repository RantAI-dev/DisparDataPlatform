<?php

namespace App\Features\Dataset\Http\Requests;

final class BarisRequest extends DatasetRequest
{
    public function rules(): array
    {
        return [
            'page' => ['nullable', 'integer', 'min:1'],
            'size' => ['nullable', 'integer', 'min:1', 'max:200'],
            'sort' => self::SORT,
            'q' => self::Q,
            ...self::filter(),
        ];
    }
}
