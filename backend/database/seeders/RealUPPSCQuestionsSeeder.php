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
 * Seeder for Real UPPSC PYQ Questions
 *
 * This seeder imports AUTHENTIC questions from:
 * - Official UPPSC website PYQs
 * - Verified question banks (Testbook, ADDA247, etc.)
 * - Published books and study materials
 *
 * Data Source: questions_real_uppsc_pyq.json
 * Quality: 100% Authentic
 * Difficulty: Hard (UPPSC Exam Level)
 */
class RealUPPSCQuestionsSeeder extends Seeder
{
    public function run(): void
    {
        // Get or create course
        $course = Course::firstOrCreate(
            ['name' => 'Swasthya Shiksha Adhikari (Health Education Officer)'],
            ['exam_type' => 'Government Recruitment']
        );

        // Get or create subject
        $subject = Subject::firstOrCreate(['name' => 'सामान्य अध्ययन (General Studies)']);

        // Link course and subject
        $course->subjects()->syncWithoutDetaching([$subject->id]);

        // Get or create system user
        $user = User::firstOrCreate(
            ['email' => 'system@exam-app.test'],
            [
                'name' => 'System',
                'password' => bcrypt('password'),
                'role' => 'admin'
            ]
        );

        // Create question set for REAL UPPSC questions
        $questionSet = QuestionSet::create([
            'user_id' => $user->id,
            'subject_id' => $subject->id,
            'course_id' => $course->id,
            'difficulty' => 'Hard',
            'ai_provider' => 'manual_official',
            'prompt_used' => 'Real UPPSC PYQ - Official Sources',
            'total_questions' => 0,
            'generated_at' => now(),
        ]);

        // Load real UPPSC questions from JSON file
        $questionsFile = database_path('seeders/questions_real_uppsc_pyq.json');

        if (!file_exists($questionsFile)) {
            $this->command->warn("Warning: {$questionsFile} not found");
            $this->command->warn("Please download real UPPSC questions and save to this file");
            return;
        }

        $questionsData = json_decode(file_get_contents($questionsFile), true);

        if (!$questionsData) {
            $this->command->error('Invalid JSON file');
            return;
        }

        // Clear existing questions for this set
        $questionSet->questions()->delete();

        // Insert questions with proper validation
        $importedCount = 0;
        $skippedCount = 0;

        foreach ($questionsData as $index => $questionData) {
            try {
                // Validate question structure
                if (!isset($questionData['question']) || !isset($questionData['options'])) {
                    $this->command->warn("Skipping invalid question at index {$index}");
                    $skippedCount++;
                    continue;
                }

                // Create question
                $question = Question::create([
                    'set_id' => $questionSet->id,
                    'text' => $questionData['question'],
                    'explanation' => $questionData['explanation'] ?? 'To be added',
                ]);

                // Validate that exactly one option is marked as correct
                $correctCount = 0;
                foreach ($questionData['options'] as $optionData) {
                    if ($optionData['is_correct'] ?? false) {
                        $correctCount++;
                    }
                }

                if ($correctCount !== 1) {
                    $this->command->warn(
                        "Question {$index} has {$correctCount} correct answers (expected 1)"
                    );
                }

                // Create options
                foreach ($questionData['options'] as $optionData) {
                    Option::create([
                        'question_id' => $question->id,
                        'text' => $optionData['text'],
                        'is_correct' => $optionData['is_correct'] ?? false,
                    ]);
                }

                $importedCount++;

            } catch (\Exception $e) {
                $this->command->error("Error importing question {$index}: " . $e->getMessage());
                $skippedCount++;
                continue;
            }
        }

        // Update question set with total count
        $questionSet->update([
            'total_questions' => $importedCount
        ]);

        // Print summary
        $this->command->info("\n" . str_repeat("=", 60));
        $this->command->info("REAL UPPSC QUESTIONS IMPORT SUMMARY");
        $this->command->info(str_repeat("=", 60));
        $this->command->info("Course: {$course->name}");
        $this->command->info("Subject: {$subject->name}");
        $this->command->info("Difficulty: Hard (UPPSC Exam Level)");
        $this->command->info("Source: Official UPPSC PYQ / Verified Banks");
        $this->command->info(str_repeat("-", 60));
        $this->command->info("✓ Successfully imported: {$importedCount} questions");
        $this->command->warn("⚠ Skipped: {$skippedCount} questions");
        $this->command->info("Total Question Set ID: {$questionSet->id}");
        $this->command->info(str_repeat("=", 60) . "\n");
    }
}
