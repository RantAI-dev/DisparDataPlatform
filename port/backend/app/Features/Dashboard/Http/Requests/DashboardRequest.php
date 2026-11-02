<?php

namespace App\Features\Dashboard\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Parameter dashboard (bentuk = laravel-openapi.draft.yaml); hanya yang lolos validasi diteruskan. */
abstract class DashboardRequest extends FormRequest
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
