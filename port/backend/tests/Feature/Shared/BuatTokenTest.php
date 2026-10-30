<?php

use App\Models\User;
use App\Shared\Auth\ServiceAccountSeeder;

beforeEach(fn () => $this->seed(ServiceAccountSeeder::class));

it('membuat token dengan satu ability dan hanya menyimpan hash-nya', function () {
    $this->artisan('portal:token', ['akun' => 'frontend', 'ability' => 'read'])
        ->expectsOutputToContain('|')
        ->assertSuccessful();

    $token = User::where('name', 'frontend')->sole()->tokens()->sole();
    expect($token->abilities)->toBe(['read'])
        ->and($token->token)->toHaveLength(64);
});

it('menolak ability yang tidak dikenal', function () {
    $this->artisan('portal:token', ['akun' => 'frontend', 'ability' => 'tulis'])->assertExitCode(2);
});

it('menolak akun yang belum ada', function () {
    $this->artisan('portal:token', ['akun' => 'tidak-ada', 'ability' => 'read'])->assertFailed();
});
