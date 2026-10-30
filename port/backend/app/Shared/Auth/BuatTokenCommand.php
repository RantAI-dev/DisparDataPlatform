<?php

namespace App\Shared\Auth;

use App\Models\User;
use Illuminate\Console\Command;

/** Membuat token Sanctum untuk akun layanan. Token dicetak sekali dan tidak pernah dicatat. */
final class BuatTokenCommand extends Command
{
    protected $signature = 'portal:token {akun : nama akun layanan, mis. frontend} {ability : read atau admin}';

    protected $description = 'Buat token akun layanan portal (dicetak sekali)';

    public function handle(): int
    {
        $ability = (string) $this->argument('ability');
        if (! in_array($ability, Ability::SEMUA, true)) {
            $this->error('ability harus salah satu dari: '.implode(', ', Ability::SEMUA));

            return self::INVALID;
        }

        $akun = User::where('name', (string) $this->argument('akun'))->first();
        if (! $akun) {
            $this->error('akun layanan tidak ada; jalankan db:seed lebih dulu');

            return self::FAILURE;
        }

        $token = $akun->createToken($ability.'-'.now()->format('Ymd-His'), [$ability]);
        $this->line($token->plainTextToken);
        $this->comment('Simpan token ini sekarang; token tidak bisa ditampilkan lagi.');

        return self::SUCCESS;
    }
}
