<?php

namespace App\Features\Indikator\Http\Requests;

final class FrameworkRequest extends IndikatorRequest
{
    public function rules(): array
    {
        return [
            // Framework indeks: GCI (Kearney) atau GPCI (Mori).
            'framework' => ['required', 'in:GCI,GPCI'],
        ];
    }
}
