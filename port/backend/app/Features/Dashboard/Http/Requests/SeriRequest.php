<?php

namespace App\Features\Dashboard\Http\Requests;

final class SeriRequest extends DashboardRequest
{
    public function rules(): array
    {
        return [
            // Jenis tamu: wisman atau wisnus.
            'tamu' => ['required', 'in:wisman,wisnus'],
        ];
    }
}
