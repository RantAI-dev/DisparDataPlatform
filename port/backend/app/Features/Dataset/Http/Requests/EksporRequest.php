<?php

namespace App\Features\Dataset\Http\Requests;

final class EksporRequest extends DatasetRequest
{
    public function rules(): array
    {
        return [
            'format' => ['nullable', 'in:csv,xlsx'],
            'sort' => self::SORT,
            'q' => self::Q,
            ...self::filter(),
        ];
    }
}
