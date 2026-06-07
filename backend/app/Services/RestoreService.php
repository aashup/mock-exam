<?php

namespace App\Services;

use App\Models\Course;
use App\Models\QuestionSet;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Builds the COMPLETE account dataset for a fresh-device restore
 * (GET /api/restore). The device bulk-inserts this with server_id populated
 * and is_dirty = 0, producing a faithful clone of the account.
 *
 * Wire shape is FLAT (one top-level array per table) to match the mobile
 * RestoreService, which builds server_id -> local_id maps as it inserts:
 *   subjects, courses, course_subjects,
 *   question_sets, questions, options,
 *   sessions, attempts, analytics, app_usage
 *
 * All ids in the payload are SERVER ids. Foreign keys reference server ids;
 * the device translates them to its local ids via the maps.
 */
class RestoreService
{
    public function fullDataset(User $user): array
    {
        // ---- Reference data (global, server-authoritative) ----
        $subjects = Subject::orderBy('id')->get(['id', 'name', 'updated_at']);

        $courses = Course::orderBy('id')->get(['id', 'name', 'exam_type', 'updated_at']);

        $courseSubjects = DB::table('course_subject')
            ->get()
            ->map(fn ($row) => [
                'course_server_id' => $row->course_id,
                'subject_server_id' => $row->subject_id,
            ]);

        // ---- Question bank: the user's own sets PLUS the shared/global bank
        // seeded under the system account, so every student gets the curated
        // questions for offline practice. ----
        $ownSets = $user->questionSets()->orderBy('id')->get();

        $systemUserId = User::where('email', 'system@exam-app.test')->value('id');
        $sharedSets = ($systemUserId && $systemUserId !== $user->id)
            ? QuestionSet::where('user_id', $systemUserId)->orderBy('id')->get()
            : collect();

        $sets = $ownSets->concat($sharedSets);
        $setIds = $sets->pluck('id');

        $questions = DB::table('questions')
            ->whereIn('set_id', $setIds)
            ->orderBy('id')
            ->get(['id', 'set_id', 'text', 'explanation', 'updated_at']);
        $questionIds = $questions->pluck('id');

        $options = DB::table('options')
            ->whereIn('question_id', $questionIds)
            ->orderBy('id')
            ->get(['id', 'question_id', 'text', 'is_correct']);

        // ---- User sessions + attempts ----
        $sessions = $user->sessions()->orderBy('id')->get([
            'id', 'set_id', 'mode', 'feedback_mode', 'total_questions',
            'duration_seconds', 'status', 'score', 'started_at', 'completed_at', 'updated_at',
        ]);
        $sessionIds = $sessions->pluck('id');

        $attempts = DB::table('attempts')
            ->whereIn('session_id', $sessionIds)
            ->orderBy('id')
            ->get([
                'id', 'session_id', 'question_id', 'selected_option_id',
                'is_correct', 'time_taken_seconds', 'answered_at',
            ]);

        return [
            'server_time' => now()->toIso8601String(),
            'subjects' => $subjects,
            'courses' => $courses,
            'course_subjects' => $courseSubjects,
            'question_sets' => $sets->map(fn ($s) => [
                'id' => $s->id,
                'subject_id' => $s->subject_id,
                'course_id' => $s->course_id,
                'difficulty' => $s->difficulty,
                'total_questions' => $s->total_questions,
                'generated_at' => optional($s->generated_at)->toIso8601String(),
                'updated_at' => optional($s->updated_at)->toIso8601String(),
            ]),
            'questions' => $questions,
            'options' => $options,
            'sessions' => $sessions,
            'attempts' => $attempts,
            'analytics' => $user->analytics()->get(),
            'app_usage' => $user->appUsage()->get(),
        ];
    }
}
