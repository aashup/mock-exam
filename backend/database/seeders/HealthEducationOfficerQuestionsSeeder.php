<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\Subject;
use App\Models\User;
use App\Models\QuestionSet;
use App\Models\Question;
use App\Models\Option;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds 500 MCQ questions for the "Swasthya Shiksha Adhikari (Health Education Officer)"
 * exam under the "सामान्य अध्ययन (General Studies)" subject.
 *
 * Questions are organized by topic and difficulty levels.
 * Each question has 4 options with one marked as correct.
 */
class HealthEducationOfficerQuestionsSeeder extends Seeder
{
    public function run(): void
    {
        // Get or create the course
        $course = Course::firstOrCreate(
            ['name' => 'Swasthya Shiksha Adhikari (Health Education Officer)'],
            ['exam_type' => 'Government Recruitment']
        );

        // Get or create the subject
        $subject = Subject::firstOrCreate(['name' => 'सामान्य अध्ययन (General Studies)']);

        // Link subject <-> course (M2M) without dropping other links.
        $course->subjects()->syncWithoutDetaching([$subject->id]);

        // Get or create a system user (for seeder data)
        $user = User::firstOrCreate(
            ['email' => 'system@exam-app.test'],
            [
                'name' => 'System',
                'password' => bcrypt('password'),
                'role' => 'admin'
            ]
        );

        // Create a question set for this course
        $questionSet = QuestionSet::firstOrCreate(
            [
                'user_id' => $user->id,
                'subject_id' => $subject->id,
                'course_id' => $course->id,
                'difficulty' => 'Easy',
            ],
            [
                'ai_provider' => 'manual',
                'prompt_used' => 'Official Swasthya Shiksha Adhikari Syllabus',
                'total_questions' => 500,
                'generated_at' => now(),
            ]
        );

        // Load questions from JSON
        $questionsData = json_decode(file_get_contents(database_path('seeders/questions_data.json')), true);

        // Clear existing questions for this set to avoid duplicates
        $questionSet->questions()->delete();

        // Insert questions and options
        foreach ($questionsData as $index => $questionData) {
            $question = Question::create([
                'set_id' => $questionSet->id,
                'text' => $questionData['question'],
                'explanation' => $questionData['explanation'],
            ]);

            // Insert options
            foreach ($questionData['options'] as $optionData) {
                Option::create([
                    'question_id' => $question->id,
                    'text' => $optionData['text'],
                    'is_correct' => $optionData['is_correct'],
                ]);
            }
        }

        // Update the question set total
        $questionSet->update(['total_questions' => count($questionsData)]);

        $this->command->info("Successfully seeded {$questionSet->total_questions} questions for {$course->name}");
    }
}
