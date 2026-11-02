<?php

namespace App\Features\Beranda\Contracts;

use App\Shared\DataApi\DataApiResponse;

interface BerandaSource
{
    /** Angka hero + stat beranda (KONTRAK §2.6, P4: angka hidup). */
    public function ringkasan(): DataApiResponse;
}
