<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\Subject;
use Illuminate\Database\Seeder;

class SubjectSeeder extends Seeder
{
    public function run(): void
    {
        // Subjects (primary driver of questions).
        $subjects = collect([
            'Mathematics', 'Physics', 'Chemistry', 'Biology',
            'English', 'General Knowledge', 'Computer Science', 'Reasoning',
        ])->mapWithKeys(fn ($name) => [
            $name => Subject::firstOrCreate(['name' => $name]),
        ]);

        // Courses (optional context) + Many-to-Many subject links.
        $courses = [
            ['name' => 'JEE Main', 'exam_type' => 'Engineering Entrance',
                'subjects' => ['Mathematics', 'Physics', 'Chemistry']],
            ['name' => 'NEET', 'exam_type' => 'Medical Entrance',
                'subjects' => ['Physics', 'Chemistry', 'Biology']],
            ['name' => 'UPSC Prelims', 'exam_type' => 'Civil Services',
                'subjects' => ['General Knowledge', 'English', 'Reasoning']],
            ['name' => 'GATE CS', 'exam_type' => 'Engineering PG',
                'subjects' => ['Computer Science', 'Mathematics', 'Reasoning']],
        ];

        foreach ($courses as $data) {
            $course = Course::firstOrCreate(
                ['name' => $data['name']],
                ['exam_type' => $data['exam_type']]
            );

            $ids = collect($data['subjects'])
                ->map(fn ($s) => $subjects[$s]->id)
                ->all();

            $course->subjects()->syncWithoutDetaching($ids);
        }
    }
}
