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
 * Imports "Social Science Related Knowledge" MCQ question bank for the
 * Swasthya Shiksha Adhikari (Health Education Officer) examination.
 *
 * Questions live in per-subject JSON files named questions/<prefix>_<level>_<NN>.json
 * (e.g. questions/socio_easy_01.json). Each file is an array of:
 *   { "question": "...", "options": [{ "text": "...", "is_correct": bool }, ...], "explanation": "..." }
 *
 * All questions are stored under the single subject "सामान्य अध्ययन (General Studies)"
 * and course "Swasthya Shiksha Adhikari (Health Education Officer)", grouped into
 * one QuestionSet per difficulty (Easy | Medium | Hard).
 */
class SocialScienceQuestionsSeeder extends Seeder
{
    /** File-name prefixes for the 8 Social Science subjects. */
    private const SUBJECT_PREFIXES = [
        'socio',     // Sociology
        'anthro',    // Anthropology
        'psych',     // Psychology
        'socpsych',  // Social Psychology
        'polsci',    // Political Science
        'geo',       // Geography
        'hist',      // History
        'eco',       // Economics
    ];

    /** Difficulty token in the file name => enum value stored in question_sets. */
    private const DIFFICULTIES = [
        'easy'   => 'Easy',
        'medium' => 'Medium',
        'hard'   => 'Hard',
    ];

    public function run(): void
    {
        // Resolve subject & course by name (created earlier in migration/seed flow).
        $course = Course::firstOrCreate(
            ['name' => 'Swasthya Shiksha Adhikari (Health Education Officer)'],
            ['exam_type' => 'Government Recruitment']
        );

        $subject = Subject::firstOrCreate(['name' => 'सामान्य अध्ययन (General Studies)']);

        $course->subjects()->syncWithoutDetaching([$subject->id]);

        $user = User::firstOrCreate(
            ['email' => 'system@exam-app.test'],
            ['name' => 'System', 'password' => bcrypt('password'), 'role' => 'admin']
        );

        foreach (self::DIFFICULTIES as $token => $difficulty) {
            $files = $this->filesForLevel($token);

            if (empty($files)) {
                $this->command->warn("No files found for difficulty '{$difficulty}' — skipping.");
                continue;
            }

            $questionSet = QuestionSet::firstOrCreate(
                [
                    'user_id'    => $user->id,
                    'subject_id' => $subject->id,
                    'course_id'  => $course->id,
                    'difficulty' => $difficulty,
                ],
                [
                    'ai_provider'     => 'manual_generated',
                    'prompt_used'     => "Social Science Related Knowledge ({$difficulty}) - UPPSC level",
                    'total_questions' => 0,
                    'generated_at'    => now(),
                ]
            );

            // Idempotent re-run: clear prior questions for this set before re-import.
            $questionSet->questions()->delete();

            $imported = 0;
            $skipped  = 0;

            foreach ($files as $file) {
                $data = json_decode(file_get_contents($file), true);

                if (!is_array($data)) {
                    $this->command->error('Invalid JSON: ' . basename($file));
                    continue;
                }

                foreach ($data as $index => $q) {
                    if (!isset($q['question'], $q['options']) || !is_array($q['options'])) {
                        $skipped++;
                        continue;
                    }

                    if (count($q['options']) !== 4) {
                        $this->command->warn(
                            basename($file) . " #{$index}: has " . count($q['options']) . ' options (expected 4)'
                        );
                        $skipped++;
                        continue;
                    }

                    $correct = array_sum(array_map(
                        fn ($o) => !empty($o['is_correct']) ? 1 : 0,
                        $q['options']
                    ));

                    if ($correct !== 1) {
                        $this->command->warn(
                            basename($file) . " #{$index}: {$correct} correct answers (expected 1)"
                        );
                        $skipped++;
                        continue;
                    }

                    $question = Question::create([
                        'set_id'      => $questionSet->id,
                        'text'        => $q['question'],
                        'explanation' => $q['explanation'] ?? null,
                    ]);

                    foreach ($q['options'] as $opt) {
                        Option::create([
                            'question_id' => $question->id,
                            'text'        => $opt['text'],
                            'is_correct'  => !empty($opt['is_correct']),
                        ]);
                    }

                    $imported++;
                }
            }

            $questionSet->update(['total_questions' => $questionSet->questions()->count()]);

            $this->command->info(str_repeat('=', 60));
            $this->command->info("Difficulty: {$difficulty}");
            $this->command->info('Files: ' . count($files));
            $this->command->info("Imported: {$imported}  |  Skipped: {$skipped}");
            $this->command->info("Question Set ID: {$questionSet->id}");
        }
    }

    /**
     * @return string[] Sorted list of JSON file paths for a given difficulty token,
     *                  scoped to the known Social Science subject prefixes.
     */
    private function filesForLevel(string $token): array
    {
        $found = [];

        foreach (self::SUBJECT_PREFIXES as $prefix) {
            $matches = glob(database_path("seeders/questions/{$prefix}_{$token}_*.json"));
            if ($matches) {
                $found = array_merge($found, $matches);
            }
        }

        sort($found);

        return $found;
    }
}
