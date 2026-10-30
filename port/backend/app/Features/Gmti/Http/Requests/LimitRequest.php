<?php

namespace App\Features\Gmti\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class LimitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Jumlah hotel paling banyak (1–500, bawaan 100).
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
        ];
    }
}
