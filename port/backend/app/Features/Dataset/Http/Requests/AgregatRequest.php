<?php

namespace App\Features\Dataset\Http\Requests;

final class AgregatRequest extends DatasetRequest
{
    public function rules(): array
    {
        return [
            'x' => ['required', 'string', 'max:200'],
            'y' => ['nullable', 'string', 'max:200'],
            'agg' => ['required', 'in:sum,avg,count,max,min'],
            'q' => self::Q,
            ...self::filter(),
        ];
    }
}
