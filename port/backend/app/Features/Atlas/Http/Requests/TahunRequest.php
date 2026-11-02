<?php

namespace App\Features\Atlas\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class TahunRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Tahun pertunjukan, `YYYY`; kosong = semua tahun.
            'tahun' => ['nullable', 'string', 'regex:/^\\d{4}$/'],
        ];
    }
}
