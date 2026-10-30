<?php

namespace App\Features\Sistem\Data;

final readonly class StatusKesehatan
{
    public function __construct(
        public bool $oracle,
        public bool $dataApi,
        public string $versi,
    ) {}

    public function sehat(): bool
    {
        return $this->oracle && $this->dataApi;
    }
}
