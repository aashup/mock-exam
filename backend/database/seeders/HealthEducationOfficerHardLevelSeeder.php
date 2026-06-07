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
 * Seeder for HARD-Level MCQ Questions
 *
 * This seeder imports 500 HARD-difficulty questions designed for:
 * - Advanced exam preparation
 * - Serious UPPSC aspirants
 * - Final stage practice before exam
 *
 * Question Features:
 * - Multi-dimensional analytical questions
 * - Require deep understanding of concepts
 * - Test application of knowledge
 * - Similar to actual UPPSC hard questions
 *
 * Difficulty Progression:
 * 1. Easy (500 questions) - Basic learning
 * 2. Medium (500 questions) - Intermediate practice
 * 3. HARD (500 questions) - Advanced preparation ← THIS SEEDER
 * 4. Real UPPSC (500+ questions) - Actual exam questions
 */
class HealthEducationOfficerHardLevelSeeder extends Seeder
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

        // Load hard-level questions from JSON file (check before creating the set
        // so a missing file never leaves an empty orphan question set).
        $questionsFile = database_path('seeders/questions_data_hard_level.json');

        if (!file_exists($questionsFile)) {
            $this->command->error("File not found: {$questionsFile}");
            $this->command->error("Please ensure the questions_data_hard_level.json exists");
            return;
        }

        // Idempotent: reuse the existing Hard set on re-run instead of duplicating.
        $questionSet = QuestionSet::firstOrCreate(
            [
                'user_id' => $user->id,
                'subject_id' => $subject->id,
                'course_id' => $course->id,
                'difficulty' => 'Hard',
            ],
            [
                'ai_provider' => 'manual_generated',
                'prompt_used' => 'Hard-Level Questions for Advanced Preparation',
                'total_questions' => 0,
                'generated_at' => now(),
            ]
        );

        $questionsData = json_decode(file_get_contents($questionsFile), true);

        if (!$questionsData) {
            $this->command->error('Invalid JSON format in questions_data_hard_level.json');
            return;
        }

        // Clear existing questions for this set
        $questionSet->questions()->delete();

        // Insert hard-level questions with validation
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

                // Ensure question has exactly 4 options
                if (count($questionData['options']) !== 4) {
                    $this->command->warn(
                        "Question {$index} has " . count($questionData['options']) .
                        " options (expected 4)"
                    );
                    $skippedCount++;
                    continue;
                }

                // Create question
                $question = Question::create([
                    'set_id' => $questionSet->id,
                    'text' => $questionData['question'],
                    'explanation' => $questionData['explanation'] ?? 'Detailed explanation pending',
                ]);

                // Verify exactly one correct answer
                $correctCount = array_sum(array_map(
                    fn($opt) => $opt['is_correct'] ? 1 : 0,
                    $questionData['options']
                ));

                if ($correctCount !== 1) {
                    $this->command->warn(
                        "Question {$index}: {$correctCount} correct answers (expected 1)"
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
                $this->command->error("Error at question {$index}: " . $e->getMessage());
                $skippedCount++;
                continue;
            }
        }

        // Update question set with total count
        $questionSet->update([
            'total_questions' => $importedCount
        ]);

        // Print detailed summary
        $this->command->info("\n" . str_repeat("=", 70));
        $this->command->info("HARD-LEVEL QUESTIONS IMPORT SUMMARY");
        $this->command->info(str_repeat("=", 70));
        $this->command->info("Course: {$course->name}");
        $this->command->info("Subject: {$subject->name}");
        $this->command->info("Difficulty Level: HARD");
        $this->command->info("Question Type: Multi-dimensional, Analytical, Complex");
        $this->command->info("Ideal For: Advanced UPPSC Preparation");
        $this->command->info(str_repeat("-", 70));
        $this->command->info("✓ Successfully imported: {$importedCount} questions");
        $this->command->warn("⚠ Skipped: {$skippedCount} questions");
        $this->command->info("Question Set ID: {$questionSet->id}");
        $this->command->info(str_repeat("=", 70));

        $this->command->info("\nDifficulty Progression:");
        $this->command->line("  Level 1: Easy (500 questions) ............. Basic Learning");
        $this->command->line("  Level 2: Medium (500 questions) .......... Intermediate Practice");
        $this->command->line("  Level 3: Hard (500 questions) ........... Advanced Preparation ✓");
        $this->command->line("  Level 4: Real UPPSC PYQ ................ Actual Exam Questions");
        $this->command->info("\n");
    }
}
