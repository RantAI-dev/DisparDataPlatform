<?php

namespace App\Features\Contoh\Http\Controllers;

use Illuminate\Support\Facades\Http;

/** FITUR PALSU (tests/Arch): controller yang memakai Http langsung, melanggar SPEC §4.3 butir 3. */
final class ContohController
{
    public function __invoke(): mixed
    {
        return Http::get('http://contoh.test')->json();
    }
}
