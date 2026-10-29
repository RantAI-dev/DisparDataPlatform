<?php

namespace App\Features\Dataset\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi parameter dataset (bentuk = laravel-openapi.draft.yaml). Hanya parameter yang lolos
 * validasi diteruskan ke Data API; nilai filter/sort sendiri divalidasi Data API (400).
 */
abstract class DatasetRequest extends FormRequest
{
    protected const Q = ['nullable', 'string', 'max:500'];

    protected const SORT = ['nullable', 'string', 'regex:/^[^:]+:(asc|desc)$/'];

    /** Filter berulang `f[]`; tiap nilai dibatasi di aturan `f.*`. */
    protected const F = ['nullable', 'array', 'max:50'];

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, scalar|array<scalar>|null> */
    public function untukDataApi(): array
    {
        return $this->validated();
    }
}
