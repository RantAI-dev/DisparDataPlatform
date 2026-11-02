<?php

namespace App\Features\Sistem\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class JobRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Nomor halaman, mulai 1; 50 baris per halaman, terbaru lebih dulu.
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
