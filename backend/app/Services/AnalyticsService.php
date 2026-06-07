<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Computes dashboard + per-subject analytics from the synced server data.
 */
class AnalyticsService
{
    /**
     * Dashboard totals matching the mobile DashboardScreen metric cards.
     */
    public function summary(User $user): array
    {
        $testsTaken = DB::table('sessions')
            ->where('user_id', $user->id)
            ->where('status', 'completed')
            ->count();

        $attempts = DB::table('attempts')
            ->join('sessions', 'attempts.session_id', '=', 'sessions.id')
            ->where('sessions.user_id', $user->id);

        $attempted = (clone $attempts)->count();
        $correct = (clone $attempts)->where('attempts.is_correct', true)->count();
        $wrong = $attempted - $correct;

        $timeOnApp = (int) DB::table('app_usage')
            ->where('user_id', $user->id)
            ->sum('seconds_active');

        $timeToday = (int) DB::table('app_usage')
            ->where('user_id', $user->id)
            ->whereDate('date', now()->toDateString())
            ->sum('seconds_active');

        return [
            'tests_taken' => $testsTaken,
            'questions_attempted' => $attempted,
            'correct' => $correct,
            'wrong' => $wrong,
            'accuracy' => $attempted > 0 ? round($correct / $attempted * 100, 2) : 0.0,
            'time_on_app_seconds' => $timeOnApp,
            'time_on_app_today_seconds' => $timeToday,
            'streak' => $this->currentStreak($user),
        ];
    }

    /**
     * Per-subject accuracy breakdown.
     */
    public function perSubject(User $user): array
    {
        return DB::table('attempts')
            ->join('sessions', 'attempts.session_id', '=', 'sessions.id')
            ->join('question_sets', 'sessions.set_id', '=', 'question_sets.id')
            ->join('subjects', 'question_sets.subject_id', '=', 'subjects.id')
            ->where('sessions.user_id', $user->id)
            ->groupBy('subjects.id', 'subjects.name')
            ->selectRaw('subjects.id as subject_id, subjects.name as subject, '
                . 'COUNT(*) as attempted, '
                . 'SUM(CASE WHEN attempts.is_correct THEN 1 ELSE 0 END) as correct')
            ->get()
            ->map(fn ($r) => [
                'subject_id' => $r->subject_id,
                'subject' => $r->subject,
                'attempted' => (int) $r->attempted,
                'correct' => (int) $r->correct,
                'accuracy' => $r->attempted > 0
                    ? round($r->correct / $r->attempted * 100, 2)
                    : 0.0,
            ])
            ->toArray();
    }

    /**
     * Consecutive days (ending today or yesterday) with a completed session.
     */
    private function currentStreak(User $user): int
    {
        $days = DB::table('sessions')
            ->where('user_id', $user->id)
            ->where('status', 'completed')
            ->whereNotNull('completed_at')
            ->selectRaw('DATE(completed_at) as d')
            ->distinct()
            ->orderByDesc('d')
            ->pluck('d')
            ->map(fn ($d) => Carbon::parse($d)->toDateString())
            ->all();

        if (empty($days)) {
            return 0;
        }

        $streak = 0;
        $cursor = Carbon::today();

        // Allow the streak to start today or yesterday.
        if ($days[0] === Carbon::yesterday()->toDateString()) {
            $cursor = Carbon::yesterday();
        } elseif ($days[0] !== $cursor->toDateString()) {
            return 0;
        }

        foreach ($days as $day) {
            if ($day === $cursor->toDateString()) {
                $streak++;
                $cursor->subDay();
            } else {
                break;
            }
        }

        return $streak;
    }
}
