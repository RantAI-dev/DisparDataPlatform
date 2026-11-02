<?php

namespace App\Features\Indikator\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

abstract class IndikatorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, scalar|null> */
    public function untukDataApi(): array
    {
        return $this->validated();
    }
}
