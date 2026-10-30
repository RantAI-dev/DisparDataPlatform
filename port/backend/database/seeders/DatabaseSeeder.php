<?php

namespace Database\Seeders;

use App\Shared\Auth\ServiceAccountSeeder;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(ServiceAccountSeeder::class);
    }
}
