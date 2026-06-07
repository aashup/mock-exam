<?php

namespace Database\Seeders;

use App\Models\Analytics;
use App\Models\Attempt;
use App\Models\Option;
use App\Models\Question;
use App\Models\QuestionSet;
use App\Models\Session;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * A ready-to-use student account with a small amount of practice history so the
 * app's Dashboard, History and Analytics screens show real data immediately
 * after a fresh-device login (which triggers GET /api/restore).
 *
 *   Email:    student@example.com
 *   Password: password
 */
class DemoStudentSeeder extends Seeder
{
    public function run(): void
    {
        $student = User::firstOrCreate(
            ['email' => 'student@example.com'],
            [
                'name' => 'Demo Student',
                'mobile' => '+1 555 0002',
                'password' => 'password',   // hashed via the model cast
                'role' => 'student',
            ]
        );

        // Only seed practice data once.
        if ($student->questionSets()->exists()) {
            return;
        }

        $maths = Subject::firstOrCreate(['name' => 'Mathematics']);

        // --- A question set with 3 questions (4 options each) ---
        $set = QuestionSet::create([
            'user_id' => $student->id,
            'subject_id' => $maths->id,
            'course_id' => null,
            'difficulty' => 'Easy',
            'ai_provider' => 'seed',
            'prompt_used' => 'Seeded demo question set.',
            'total_questions' => 3,
            'generated_at' => now(),
        ]);

        $bank = [
            [
                'text' => 'What is 7 + 5?',
                'explanation' => '7 + 5 = 12.',
                'options' => [['10', false], ['11', false], ['12', true], ['13', false]],
            ],
            [
                'text' => 'What is 9 × 3?',
                'explanation' => '9 × 3 = 27.',
                'options' => [['18', false], ['27', true], ['24', false], ['29', false]],
            ],
            [
                'text' => 'What is the square root of 81?',
                'explanation' => '9 × 9 = 81.',
                'options' => [['7', false], ['8', false], ['9', true], ['18', false]],
            ],
        ];

        /** @var array<int, array{question: Question, correct: Option, wrong: Option}> $built */
        $built = [];
        foreach ($bank as $row) {
            $question = Question::create([
                'set_id' => $set->id,
                'text' => $row['text'],
                'explanation' => $row['explanation'],
            ]);

            $correct = null;
            $wrong = null;
            foreach ($row['options'] as [$text, $isCorrect]) {
                $opt = Option::create([
                    'question_id' => $question->id,
                    'text' => $text,
                    'is_correct' => $isCorrect,
                ]);
                if ($isCorrect) {
                    $correct = $opt;
                } elseif (! $wrong) {
                    $wrong = $opt;
                }
            }

            $built[] = ['question' => $question, 'correct' => $correct, 'wrong' => $wrong];
        }

        // --- A completed session: 2 correct, 1 wrong (≈66.7% accuracy) ---
        $startedAt = Carbon::now()->subDay();
        $session = Session::create([
            'user_id' => $student->id,
            'set_id' => $set->id,
            'mode' => 'untimed',
            'feedback_mode' => 'end',
            'total_questions' => 3,
            'duration_seconds' => null,
            'score' => 66.67,
            'status' => 'completed',
            'started_at' => $startedAt,
            'completed_at' => $startedAt->copy()->addMinutes(4),
        ]);

        foreach ($built as $i => $b) {
            $isCorrect = $i < 2; // first two correct, last one wrong
            Attempt::create([
                'session_id' => $session->id,
                'question_id' => $b['question']->id,
                'selected_option_id' => $isCorrect ? $b['correct']->id : $b['wrong']->id,
                'is_correct' => $isCorrect,
                'time_taken_seconds' => 20 + $i * 5,
                'answered_at' => $startedAt->copy()->addMinutes($i + 1),
            ]);
        }

        // --- Analytics rollup for the subject ---
        Analytics::create([
            'user_id' => $student->id,
            'subject_id' => $maths->id,
            'course_id' => null,
            'difficulty' => 'Easy',
            'total_attempted' => 3,
            'total_correct' => 2,
            'accuracy_percent' => 66.67,
            'avg_time_per_question' => 25,
        ]);
    }
}
