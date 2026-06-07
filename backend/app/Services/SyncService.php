<?php

namespace App\Services;

use App\Models\Analytics;
use App\Models\AppUsage;
use App\Models\Attempt;
use App\Models\Course;
use App\Models\Option;
use App\Models\Question;
use App\Models\QuestionSet;
use App\Models\Session;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Central sync engine.
 *
 *  push():  device → server. Consumes FLAT top-level arrays of dirty rows. Each
 *           row carries its device-local `id` and (when known) `server_id`.
 *           Parent foreign keys arrive as BOTH the local id (e.g. set_id) and
 *           the resolved parent server id (e.g. set_server_id, nullable). Rows
 *           are processed parent-first so newly-created parents populate a
 *           within-batch local→server map that children fall back to.
 *           Last-write-wins per row via updated_at. Returns id mappings as
 *           { table: [ { local_id, server_id }, ... ] } so the device can fill
 *           its server_id columns.
 *
 *  pull():  server → device. Reference data (subjects/courses + M2M) is always
 *           server-authoritative; user data is filtered by updated_at.
 */
class SyncService
{
    /** @var array<string, array<int|string,string>> local_id => server_id (UUID), per table */
    private array $map = [];

    public function push(User $user, array $payload): array
    {
        $this->map = [
            'question_sets' => [],
            'questions' => [],
            'options' => [],
            'sessions' => [],
            'attempts' => [],
            'analytics' => [],
            'app_usage' => [],
            'locations' => [],
        ];
        $deviceId = $payload['device_id'] ?? null;
        $count = 0;

        DB::transaction(function () use ($user, $payload, $deviceId, &$count) {
            // ---- question_sets (parents first) ----
            foreach ($payload['question_sets'] ?? [] as $row) {
                $set = $this->upsertOwned(QuestionSet::class, $user, $row, [
                    'subject_id' => $row['subject_server_id'] ?? null,
                    'course_id' => $row['course_server_id'] ?? null,
                    'difficulty' => $row['difficulty'] ?? 'Medium',
                    'ai_provider' => $row['ai_provider'] ?? null,
                    'prompt_used' => $row['prompt_used'] ?? null,
                    'total_questions' => $row['total_questions'] ?? 0,
                    'generated_at' => $this->ts($row['generated_at'] ?? null),
                ]);
                if ($set) {
                    $this->map['question_sets'][$row['id']] = $set->id;
                    $count++;
                }
            }

            // ---- questions ----
            foreach ($payload['questions'] ?? [] as $row) {
                $setId = $this->resolveFk($row, 'set_server_id', 'set_id', 'question_sets');
                if (! $setId) {
                    continue; // parent unknown; will retry next sync
                }
                // Skip orphan rows whose resolved parent no longer exists,
                // rather than letting an FK violation roll back the whole push.
                if (! QuestionSet::whereKey($setId)->exists()) {
                    continue;
                }
                $q = $this->upsertChild(Question::class, $row, [
                    'set_id' => $setId,
                    'text' => $row['text'] ?? '',
                    'explanation' => $row['explanation'] ?? null,
                ]);
                if ($q) {
                    $this->map['questions'][$row['id']] = $q->id;
                    $count++;
                }
            }

            // ---- options ----
            foreach ($payload['options'] ?? [] as $row) {
                $questionId = $this->resolveFk($row, 'question_server_id', 'question_id', 'questions');
                if (! $questionId) {
                    continue;
                }
                // Skip orphan rows whose resolved parent no longer exists,
                // rather than letting an FK violation roll back the whole push.
                if (! Question::whereKey($questionId)->exists()) {
                    continue;
                }
                $o = $this->upsertChild(Option::class, $row, [
                    'question_id' => $questionId,
                    'text' => $row['text'] ?? '',
                    'is_correct' => (bool) ($row['is_correct'] ?? false),
                ]);
                if ($o) {
                    $this->map['options'][$row['id']] = $o->id;
                    $count++;
                }
            }

            // ---- sessions ----
            foreach ($payload['sessions'] ?? [] as $row) {
                $setId = $this->resolveFk($row, 'set_server_id', 'set_id', 'question_sets');
                if (! $setId) {
                    continue;
                }
                // Guard against stale/orphan references (e.g. a device holding
                // integer server_ids from before the UUID migration, or a set
                // that was since re-seeded). A missing parent would otherwise
                // raise an FK violation and roll back the ENTIRE push, so we
                // skip the orphan row instead — it retries on the next sync.
                if (! QuestionSet::whereKey($setId)->exists()) {
                    continue;
                }
                $session = $this->upsertOwned(Session::class, $user, $row, [
                    'set_id' => $setId,
                    'mode' => $row['mode'] ?? 'untimed',
                    'feedback_mode' => $row['feedback_mode'] ?? 'end',
                    'total_questions' => $row['total_questions'] ?? 0,
                    'duration_seconds' => $row['duration_seconds'] ?? null,
                    'score' => $row['score'] ?? null,
                    'status' => $row['status'] ?? 'active',
                    'started_at' => $this->ts($row['started_at'] ?? null),
                    'completed_at' => $this->ts($row['completed_at'] ?? null),
                ]);
                if ($session) {
                    $this->map['sessions'][$row['id']] = $session->id;
                    $count++;
                }
            }

            // ---- attempts ----
            foreach ($payload['attempts'] ?? [] as $row) {
                $sessionId = $this->resolveFk($row, 'session_server_id', 'session_id', 'sessions');
                $questionId = $this->resolveFk($row, 'question_server_id', 'question_id', 'questions');
                if (! $sessionId || ! $questionId) {
                    continue;
                }
                // Guard against stale/orphan references (e.g. a device holding
                // server_ids from a question bank that was since re-seeded). A
                // missing parent would otherwise raise an FK violation and roll
                // back the ENTIRE push, so we skip the orphan row instead.
                if (! Question::whereKey($questionId)->exists()) {
                    continue;
                }
                $optionId = $this->resolveFk(
                    $row, 'selected_option_server_id', 'selected_option_id', 'options'
                );
                if ($optionId && ! Option::whereKey($optionId)->exists()) {
                    $optionId = null; // drop a dangling option ref, keep the attempt
                }
                $attempt = $this->upsertChild(Attempt::class, $row, [
                    'session_id' => $sessionId,
                    'question_id' => $questionId,
                    'selected_option_id' => $optionId,
                    'is_correct' => (bool) ($row['is_correct'] ?? false),
                    'time_taken_seconds' => $row['time_taken_seconds'] ?? null,
                    'answered_at' => $this->ts($row['answered_at'] ?? null),
                ]);
                if ($attempt) {
                    $this->map['attempts'][$row['id']] = $attempt->id;
                    $count++;
                }
            }

            // ---- analytics ----
            foreach ($payload['analytics'] ?? [] as $row) {
                // Reference FKs are nullable — drop stale/unknown refs rather
                // than risk an FK violation that rolls back the whole push.
                $subjectId = $row['subject_server_id'] ?? null;
                if ($subjectId && ! Subject::whereKey($subjectId)->exists()) {
                    $subjectId = null;
                }
                $courseId = $row['course_server_id'] ?? null;
                if ($courseId && ! Course::whereKey($courseId)->exists()) {
                    $courseId = null;
                }
                $rec = $this->upsertOwned(Analytics::class, $user, $row, [
                    'subject_id' => $subjectId,
                    'course_id' => $courseId,
                    'difficulty' => $row['difficulty'] ?? null,
                    'total_attempted' => $row['total_attempted'] ?? 0,
                    'total_correct' => $row['total_correct'] ?? 0,
                    'accuracy_percent' => $row['accuracy_percent'] ?? 0,
                    'avg_time_per_question' => $row['avg_time_per_question'] ?? 0,
                ]);
                if ($rec) {
                    $this->map['analytics'][$row['id']] = $rec->id;
                    $count++;
                }
            }

            // ---- app_usage (per user + device + day) ----
            foreach ($payload['app_usage'] ?? [] as $row) {
                $date = $this->ts($row['date'] ?? null)?->toDateString() ?? now()->toDateString();
                $usage = AppUsage::firstOrNew([
                    'user_id' => $user->id,
                    'device_id' => $row['device_id'] ?? $deviceId,
                    'date' => $date,
                ]);
                // Device value is the authoritative running total for that device/day.
                $usage->seconds_active = $row['seconds_active'] ?? $usage->seconds_active;
                $usage->save();
                $this->map['app_usage'][$row['id']] = $usage->id;
                $count++;
            }

            // ---- device_locations ----
            foreach ($payload['locations'] ?? [] as $row) {
                $recordedAt = $row['recorded_at'] ?? null;
                DB::table('device_locations')->updateOrInsert(
                    [
                        'user_id' => $user->id,
                        'device_id' => $deviceId,
                        'recorded_at' => $recordedAt,
                    ],
                    [
                        'latitude' => $row['latitude'],
                        'longitude' => $row['longitude'],
                        'accuracy' => $row['accuracy'],
                        'altitude' => $row['altitude'] ?? null,
                        'speed' => $row['speed'] ?? null,
                        'heading' => $row['heading'] ?? null,
                        'location_source' => $row['location_source'] ?? 'fused',
                        'battery_level' => $row['battery_level'] ?? null,
                        'updated_at' => now(),
                        'created_at' => now(),
                    ]
                );
                $serverId = DB::table('device_locations')
                    ->where('user_id', $user->id)
                    ->where('device_id', $deviceId)
                    ->where('recorded_at', $recordedAt)
                    ->value('id');
                if (isset($row['id']) && $serverId) {
                    $this->map['locations'][$row['id']] = (string) $serverId;
                }
                $count++;
            }
        });

        $user->forceFill(['last_sync_at' => now()])->save();

        DB::table('sync_logs')->insert([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'device_id' => $deviceId,
            'synced_at' => now(),
            'records_synced' => $count,
            'status' => 'success',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return [
            'mappings' => $this->mappingsForWire(),
            'records_synced' => $count,
        ];
    }

    /**
     * Server changes since the given timestamp. Reference data is always
     * server-authoritative; user data is filtered by updated_at.
     */
    public function pull(User $user, ?string $since): array
    {
        $sinceTs = $since ? Carbon::parse($since) : null;

        $filter = fn ($query) => $sinceTs
            ? $query->where('updated_at', '>', $sinceTs)
            : $query;

        // Question-set delta = the user's own changed sets PLUS the shared/global
        // bank seeded under the system account, so every student receives the
        // curated questions (and can practise them OFFLINE).
        $ownSets = $filter($user->questionSets()->getQuery())->get();

        $systemUserId = User::where('email', 'system@exam-app.test')->value('id');
        $sharedSets = ($systemUserId && $systemUserId !== $user->id)
            ? $filter(QuestionSet::query()->where('user_id', $systemUserId))->get()
            : collect();

        $sets = $ownSets->concat($sharedSets);
        $setIds = $sets->pluck('id');

        // The questions + options for every set in this delta. The device's
        // applyDelta upserts them keyed by server_id (server-authoritative).
        $questions = $setIds->isEmpty()
            ? collect()
            : Question::whereIn('set_id', $setIds)->orderBy('id')
                ->get(['id', 'set_id', 'text', 'explanation', 'updated_at']);
        $questionIds = $questions->pluck('id');
        $options = $questionIds->isEmpty()
            ? collect()
            : Option::whereIn('question_id', $questionIds)->orderBy('id')
                ->get(['id', 'question_id', 'text', 'is_correct']);

        $locations = $sinceTs
            ? DB::table('device_locations')
                ->where('user_id', $user->id)
                ->where('updated_at', '>', $sinceTs)
                ->get()
            : DB::table('device_locations')
                ->where('user_id', $user->id)
                ->get();

        return [
            'server_time' => now()->toIso8601String(),
            // Server-authoritative reference data + M2M pivot.
            // Field names match the mobile subjectRepo upsert contract.
            'subjects' => Subject::orderBy('name')->get()->map(fn ($s) => [
                'server_id' => $s->id,
                'name' => $s->name,
            ]),
            'courses' => Course::with('subjects:id')->orderBy('name')->get()->map(fn ($c) => [
                'server_id' => $c->id,
                'name' => $c->name,
                'exam_type' => $c->exam_type,
                'subject_server_ids' => $c->subjects->pluck('id'),
            ]),
            // User-data deltas (server ids; the device reconciles by server_id).
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
            'sessions' => $filter($user->sessions()->getQuery())->get(),
            'analytics' => $filter($user->analytics()->getQuery())->get(),
            'app_usage' => $filter($user->appUsage()->getQuery())->get(),
            'locations' => $locations,
        ];
    }

    /**
     * Resolve a parent foreign key to a server id: prefer the server id the
     * device already knew, else fall back to the within-batch local→server map.
     */
    private function resolveFk(array $row, string $serverField, string $localField, string $mapTable): ?string
    {
        if (! empty($row[$serverField])) {
            return (string) $row[$serverField];
        }
        $localId = $row[$localField] ?? null;

        return $localId !== null ? ($this->map[$mapTable][$localId] ?? null) : null;
    }

    /**
     * Upsert a row owned by a user, honouring last-write-wins on updated_at.
     */
    private function upsertOwned(string $model, User $user, array $row, array $attrs): mixed
    {
        $serverId = $row['server_id'] ?? null;
        $existing = $serverId ? $model::where('user_id', $user->id)->find($serverId) : null;

        if ($existing && ! $this->incomingIsNewer($row, $existing)) {
            return $existing; // server copy wins
        }

        $attrs['user_id'] = $user->id;

        if ($existing) {
            $existing->fill($attrs)->save();

            return $existing;
        }

        return $model::create($attrs);
    }

    /**
     * Upsert a child row (ownership flows through its parent).
     */
    private function upsertChild(string $model, array $row, array $attrs): mixed
    {
        $serverId = $row['server_id'] ?? null;
        $existing = $serverId ? $model::find($serverId) : null;

        if ($existing && ! $this->incomingIsNewer($row, $existing)) {
            return $existing;
        }

        if ($existing) {
            $existing->fill($attrs)->save();

            return $existing;
        }

        return $model::create($attrs);
    }

    private function incomingIsNewer(array $row, mixed $existing): bool
    {
        $incoming = $this->ts($row['updated_at'] ?? null);
        if (! $incoming || ! $existing->updated_at) {
            return true; // no timestamp → treat device as newer
        }

        return $incoming->greaterThanOrEqualTo($existing->updated_at);
    }

    /**
     * Convert the internal { local_id => server_id } maps into the wire shape
     * the device expects: { table: [ { local_id, server_id }, ... ] }.
     */
    private function mappingsForWire(): array
    {
        $out = [];
        foreach ($this->map as $table => $pairs) {
            $out[$table] = [];
            foreach ($pairs as $localId => $serverId) {
                $out[$table][] = ['local_id' => $localId, 'server_id' => $serverId];
            }
        }

        return $out;
    }

    private function ts(?string $value): ?Carbon
    {
        return $value ? Carbon::parse($value) : null;
    }
}
