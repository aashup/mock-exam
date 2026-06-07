<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Admin',
                'mobile' => '+1 555 0001',
                'password' => 'password',   // hashed via the model cast
                'role' => 'admin',
            ]
        );
    }
}
