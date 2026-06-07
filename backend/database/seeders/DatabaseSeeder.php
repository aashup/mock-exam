<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            AdminUserSeeder::class,
            SubjectSeeder::class,
            DemoStudentSeeder::class,
            // Health Education Officer course/subject/topics setup.
            HealthEducationOfficerSeeder::class,
            // All JSON question-bank files in one seeder with progress output.
            // To add a new file, append an entry to QuestionImportSeeder::IMPORT_MANIFEST.
            QuestionImportSeeder::class,
        ]);
    }
}
