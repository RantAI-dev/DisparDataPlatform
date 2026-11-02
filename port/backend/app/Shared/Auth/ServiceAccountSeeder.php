<?php

namespace App\Shared\Auth;

use App\Models\User;
use Illuminate\Database\Seeder;

/** Akun layanan portal. Tanpa password dan tanpa token; token dibuat lewat `portal:token`. */
final class ServiceAccountSeeder extends Seeder
{
    /** frontend = server Nuxt (ability read); admin = operator (ability admin). */
    public const AKUN = ['frontend', 'admin'];

    public function run(): void
    {
        foreach (self::AKUN as $nama) {
            User::firstOrCreate(['name' => $nama]);
        }
    }
}
