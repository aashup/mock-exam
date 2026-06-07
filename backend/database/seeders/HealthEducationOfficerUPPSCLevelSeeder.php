<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\Subject;
use App\Models\User;
use App\Models\QuestionSet;
use App\Models\Question;
use App\Models\Option;
use Illuminate\Database\Seeder;

/**
 * Seeds 500 UPPSC-level MCQ questions for "Swasthya Shiksha Adhikari"
 * These are advanced difficulty questions based on UPPSC exam pattern
 * with higher complexity and analytical thinking requirements.
 */
class HealthEducationOfficerUPPSCLevelSeeder extends Seeder
{
    public function run(): void
    {
        $course = Course::firstOrCreate(
            ['name' => 'Swasthya Shiksha Adhikari (Health Education Officer)'],
            ['exam_type' => 'Government Recruitment']
        );

        $subject = Subject::firstOrCreate(['name' => 'सामान्य अध्ययन (General Studies)']);

        $course->subjects()->syncWithoutDetaching([$subject->id]);

        $user = User::firstOrCreate(
            ['email' => 'system@exam-app.test'],
            [
                'name' => 'System',
                'password' => bcrypt('password'),
                'role' => 'admin'
            ]
        );

        // Create a separate question set for UPPSC-level questions
        $questionSet = QuestionSet::firstOrCreate(
            [
                'user_id' => $user->id,
                'subject_id' => $subject->id,
                'course_id' => $course->id,
                'difficulty' => 'Medium',
            ],
            [
                'ai_provider' => 'manual',
                'prompt_used' => 'UPPSC Swasthya Shiksha Adhikari - Medium Level',
                'total_questions' => 500,
                'generated_at' => now(),
            ]
        );

        // Load UPPSC-level questions
        $questionsData = json_decode(
            file_get_contents(database_path('seeders/questions_data_uppsc_level.json')),
            true
        );

        // Clear existing questions for this set
        $questionSet->questions()->delete();

        // Insert questions
        foreach ($questionsData as $questionData) {
            $question = Question::create([
                'set_id' => $questionSet->id,
                'text' => $questionData['question'],
                'explanation' => $questionData['explanation'],
            ]);

            foreach ($questionData['options'] as $optionData) {
                Option::create([
                    'question_id' => $question->id,
                    'text' => $optionData['text'],
                    'is_correct' => $optionData['is_correct'],
                ]);
            }
        }

        $questionSet->update(['total_questions' => count($questionsData)]);

        $this->command->info("Successfully seeded {$questionSet->total_questions} UPPSC-level questions");
    }
}
