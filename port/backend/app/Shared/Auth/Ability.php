<?php

namespace App\Shared\Auth;

/** Ability token Sanctum (SPEC §4.4). */
final class Ability
{
    /** Token server Nuxt: semua rute baca. */
    public const READ = 'read';

    /** Token admin: log dan pemicu job. */
    public const ADMIN = 'admin';

    public const SEMUA = [self::READ, self::ADMIN];
}
