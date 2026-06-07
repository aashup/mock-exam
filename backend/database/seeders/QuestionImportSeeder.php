<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\Option;
use App\Models\Question;
use App\Models\QuestionSet;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Single entry point for all JSON question-bank imports.
 *
 * Files are auto-discovered from database/seeders/questions/ and grouped into
 * one QuestionSet per difficulty. The manifest maps difficulty → seed files.
 * Glob patterns expand at runtime so new files are picked up automatically.
 *
 * Expected JSON structure (array of objects):
 *   [
 *     {
 *       "question": "...",
 *       "explanation": "...",   // optional
 *       "options": [
 *         { "text": "...", "is_correct": true  },
 *         { "text": "...", "is_correct": false },
 *         ...
 *       ]
 *     },
 *     ...
 *   ]
 */
class QuestionImportSeeder extends Seeder
{
    // ── Shared entities ───────────────────────────────────────────────────────
    private const COURSE_NAME  = 'Swasthya Shiksha Adhikari (Health Education Officer)';
    private const SUBJECT_NAME = 'सामान्य अध्ययन (General Studies)';
    private const SYSTEM_EMAIL = 'system@exam-app.test';

    // ── Difficulty groups ─────────────────────────────────────────────────────
    // Each entry = one QuestionSet.
    // 'explicit' lists files by name (relative to seeders/questions/).
    // 'glob'     is a pattern also relative to seeders/questions/ — auto-discovers the rest.
    private const DIFFICULTY_GROUPS = [
        [
            'difficulty' => 'Easy',
            'prompt'     => 'Official Swasthya Shiksha Adhikari Syllabus — Easy',
            'explicit'   => ['questions_data.json'],
            'glob'       => '*_easy_*.json',
        ],
        [
            'difficulty' => 'Medium',
            'prompt'     => 'UPPSC Swasthya Shiksha Adhikari — Medium Level',
            'explicit'   => ['questions_data_uppsc_level.json'],
            'glob'       => '*_medium_*.json',
        ],
        [
            'difficulty' => 'Hard',
            'prompt'     => 'Hard-Level Questions for Advanced Preparation',
            'explicit'   => ['questions_data_hard_level.json'],
            'glob'       => '*_hard_*.json',
        ],
    ];

    // ─────────────────────────────────────────────────────────────────────────

    public function run(): void
    {
        $dir = database_path('seeders/questions');

        $course  = Course::firstOrCreate(
            ['name' => self::COURSE_NAME],
            ['exam_type' => 'Government Recruitment'],
        );
        $subject = Subject::firstOrCreate(['name' => self::SUBJECT_NAME]);
        $user    = User::firstOrCreate(
            ['email' => self::SYSTEM_EMAIL],
            ['name' => 'System', 'password' => bcrypt('password'), 'role' => 'admin'],
        );
        $course->subjects()->syncWithoutDetaching([$subject->id]);

        $grandImported = 0;
        $grandSkipped  = 0;

        foreach (self::DIFFICULTY_GROUPS as $group) {
            $files = $this->resolveFiles($dir, $group['explicit'], $group['glob']);

            if (empty($files)) {
                $this->warn("  No files found for {$group['difficulty']} — skipping.");
                continue;
            }

            $totalFiles     = count($files);
            $groupImported  = 0;
            $groupSkipped   = 0;

            // ── Header ────────────────────────────────────────────────────────
            $this->line('');
            $this->line(str_repeat('─', 64));
            $this->info(sprintf(
                '  %s  (%d file%s)',
                strtoupper($group['difficulty']),
                $totalFiles,
                $totalFiles === 1 ? '' : 's',
            ));
            $this->line(str_repeat('─', 64));

            // ── Reuse or create the QuestionSet ───────────────────────────────
            $questionSet = QuestionSet::firstOrCreate(
                [
                    'user_id'    => $user->id,
                    'subject_id' => $subject->id,
                    'course_id'  => $course->id,
                    'difficulty' => $group['difficulty'],
                ],
                [
                    'ai_provider'     => 'manual_generated',
                    'prompt_used'     => $group['prompt'],
                    'total_questions' => 0,
                    'generated_at'    => now(),
                ],
            );

            // Clear old questions so a re-run is idempotent.
            $questionSet->questions()->delete();

            // ── Import each file ──────────────────────────────────────────────
            foreach ($files as $idx => $filePath) {
                $fileNum  = $idx + 1;
                $basename = basename($filePath);

                if (! file_exists($filePath)) {
                    $this->warn("  [{$fileNum}/{$totalFiles}] {$basename} — NOT FOUND, skipped.");
                    continue;
                }

                $data = json_decode(file_get_contents($filePath), true);

                if (! is_array($data) || empty($data)) {
                    $this->warn("  [{$fileNum}/{$totalFiles}] {$basename} — invalid/empty JSON, skipped.");
                    continue;
                }

                $count = count($data);
                $this->line(sprintf(
                    '  [%d/%d] %-45s %4d questions',
                    $fileNum, $totalFiles, $basename, $count,
                ));

                $imported = 0;
                $skipped  = 0;

                $this->command->getOutput()->progressStart($count);

                foreach ($data as $index => $q) {
                    if ($this->importQuestion($questionSet->id, $q, $index, $basename)) {
                        $imported++;
                    } else {
                        $skipped++;
                    }
                    $this->command->getOutput()->progressAdvance();
                }

                $this->command->getOutput()->progressFinish();

                $status = $skipped > 0
                    ? "  ✓ {$imported} imported   ✗ {$skipped} skipped"
                    : "  ✓ {$imported} imported";
                $this->line($status);
                $this->line('');

                $groupImported += $imported;
                $groupSkipped  += $skipped;
            }

            $questionSet->update(['total_questions' => $groupImported]);

            $grandImported += $groupImported;
            $grandSkipped  += $groupSkipped;

            $this->info(sprintf(
                '  %s SUBTOTAL  %d imported  |  %d skipped  |  Set ID: %s',
                strtoupper($group['difficulty']),
                $groupImported,
                $groupSkipped,
                $questionSet->id,
            ));
        }

        // ── Grand total ───────────────────────────────────────────────────────
        $this->line('');
        $this->line(str_repeat('═', 64));
        $this->info(sprintf(
            '  GRAND TOTAL  %d imported  |  %d skipped',
            $grandImported,
            $grandSkipped,
        ));
        $this->line(str_repeat('═', 64));
        $this->line('');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Build the ordered file list for one difficulty group:
     * explicit files first (in defined order), then any glob matches
     * not already included, sorted alphabetically.
     */
    private function resolveFiles(string $dir, array $explicit, string $pattern): array
    {
        $files = [];

        // Explicit files first (preserve defined order).
        foreach ($explicit as $name) {
            $path = "{$dir}/{$name}";
            if (file_exists($path)) {
                $files[] = $path;
            }
        }

        // Glob matches that are not already listed.
        $globbed = glob("{$dir}/{$pattern}") ?: [];
        sort($globbed);
        foreach ($globbed as $path) {
            if (! in_array($path, $files, true)) {
                $files[] = $path;
            }
        }

        return $files;
    }

    private function importQuestion(string $setId, mixed $q, int $index, string $filename): bool
    {
        if (! isset($q['question'], $q['options']) || ! is_array($q['options'])) {
            $this->warn("    [{$filename} #{$index}] Missing question/options — skipped.");
            return false;
        }

        if (count($q['options']) !== 4) {
            $this->warn(sprintf(
                '    [%s #%d] %d options (expected 4) — skipped.',
                $filename, $index, count($q['options']),
            ));
            return false;
        }

        $correctCount = array_sum(array_map(
            fn ($o) => ! empty($o['is_correct']) ? 1 : 0,
            $q['options'],
        ));

        if ($correctCount !== 1) {
            $this->warn(sprintf(
                '    [%s #%d] %d correct answers (expected 1) — skipped.',
                $filename, $index, $correctCount,
            ));
            return false;
        }

        try {
            $question = Question::create([
                'set_id'      => $setId,
                'text'        => $q['question'],
                'explanation' => $q['explanation'] ?? null,
            ]);

            foreach ($q['options'] as $opt) {
                Option::create([
                    'question_id' => $question->id,
                    'text'        => $opt['text'],
                    'is_correct'  => ! empty($opt['is_correct']),
                ]);
            }

            return true;
        } catch (\Throwable $e) {
            $this->warn("    [{$filename} #{$index}] DB error: {$e->getMessage()} — skipped.");
            return false;
        }
    }

    private function line(string $msg): void  { $this->command?->line($msg); }
    private function info(string $msg): void  { $this->command?->info($msg); }
    private function warn(string $msg): void  { $this->command?->warn($msg); }
}
