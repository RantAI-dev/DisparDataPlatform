<?php

namespace App\Features\Sistem\Data;

/** Satu halaman daftar admin (log, job), terbaru lebih dulu. */
final readonly class Halaman
{
    public const UKURAN = 50;

    /** @param list<array<string, mixed>> $item */
    public function __construct(
        public array $item,
        public int $page,
        public int $total,
    ) {}

    public function adaLagi(): bool
    {
        return $this->page * self::UKURAN < $this->total;
    }
}
