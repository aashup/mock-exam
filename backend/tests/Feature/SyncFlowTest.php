<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Subject;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * End-to-end exercise of the offline-sync wire contract:
 *   register → push (flat device payload) → pull (deltas) → restore (full clone).
 *
 * This is the contract the mobile SyncService / RestoreService rely on; the
 * field names and nesting here must stay in lock-step with the client.
 */
class SyncFlowTest extends TestCase
{
    use RefreshDatabase;

    private string $token;
    private Subject $subject;
    private Course $course;

    protected function setUp(): void
    {
        parent::setUp();

        // Reference data (normally created by an admin / seeder).
        $this->subject = Subject::create(['name' => 'Mathematics']);
        $this->course = Course::create(['name' => 'JEE Main', 'exam_type' => 'Engineering']);
        $this->course->subjects()->sync([$this->subject->id]);

        // Register a student and capture the Sanctum token.
        $res = $this->postJson('/api/auth/register', [
            'name' => 'Test Student',
            'email' => 'student@example.com',
            'mobile' => '+1 555 0102',
            'password' => 'password123',
            'device_id' => 'device-A',
        ])->assertCreated();

        $this->token = $res->json('token');
    }

    private function auth(array $headers = []): array
    {
        return array_merge([
            'Authorization' => 'Bearer ' . $this->token,
            'X-Device-Id' => 'device-A',
        ], $headers);
    }

    public function test_push_upserts_flat_payload_and_resolves_foreign_keys(): void
    {
        $now = now()->toIso8601String();

        $payload = [
            'device_id' => 'device-A',
            'last_synced_at' => null,
            'question_sets' => [[
                'id' => 1, 'server_id' => null,
                'subject_server_id' => $this->subject->id,
                'course_server_id' => $this->course->id,
                'difficulty' => 'Medium', 'total_questions' => 2,
                'generated_at' => $now, 'updated_at' => $now,
            ]],
            'questions' => [
                ['id' => 10, 'server_id' => null, 'set_id' => 1, 'set_server_id' => null,
                 'text' => 'Q1', 'explanation' => 'E1', 'updated_at' => $now],
                ['id' => 11, 'server_id' => null, 'set_id' => 1, 'set_server_id' => null,
                 'text' => 'Q2', 'explanation' => null, 'updated_at' => $now],
            ],
            'options' => [
                ['id' => 100, 'server_id' => null, 'question_id' => 10, 'question_server_id' => null,
                 'text' => 'A', 'is_correct' => true],
                ['id' => 101, 'server_id' => null, 'question_id' => 10, 'question_server_id' => null,
                 'text' => 'B', 'is_correct' => false],
                ['id' => 102, 'server_id' => null, 'question_id' => 11, 'question_server_id' => null,
                 'text' => 'C', 'is_correct' => true],
            ],
            'sessions' => [[
                'id' => 5, 'server_id' => null, 'set_id' => 1, 'set_server_id' => null,
                'mode' => 'untimed', 'feedback_mode' => 'end', 'total_questions' => 2,
                'duration_seconds' => null, 'score' => 50.0, 'status' => 'completed',
                'started_at' => $now, 'completed_at' => $now, 'updated_at' => $now,
            ]],
            'attempts' => [[
                'id' => 50, 'server_id' => null,
                'session_id' => 5, 'session_server_id' => null,
                'question_id' => 10, 'question_server_id' => null,
                'selected_option_id' => 100, 'selected_option_server_id' => null,
                'is_correct' => true, 'time_taken_seconds' => 12, 'answered_at' => $now,
            ]],
            'analytics' => [[
                'id' => 7, 'server_id' => null,
                'subject_server_id' => $this->subject->id, 'course_server_id' => null,
                'difficulty' => 'Medium', 'total_attempted' => 2, 'total_correct' => 1,
                'accuracy_percent' => 50, 'avg_time_per_question' => 11, 'updated_at' => $now,
            ]],
            'app_usage' => [[
                'id' => 3, 'server_id' => null, 'date' => '2026-05-29',
                'seconds_active' => 300, 'updated_at' => $now,
            ]],
        ];

        $res = $this->withHeaders($this->auth())
            ->postJson('/api/sync', $payload)
            ->assertOk();

        // Mappings are arrays of { local_id, server_id }.
        $setMap = collect($res->json('mappings.question_sets'));
        $this->assertCount(1, $setMap);
        $this->assertEquals(1, $setMap->first()['local_id']);
        $serverSetId = $setMap->first()['server_id'];

        $this->assertCount(2, $res->json('mappings.questions'));
        $this->assertCount(3, $res->json('mappings.options'));
        $this->assertCount(1, $res->json('mappings.sessions'));
        $this->assertCount(1, $res->json('mappings.attempts'));

        // FK resolution: the question_set points at the real subject + course.
        $this->assertDatabaseHas('question_sets', [
            'id' => $serverSetId,
            'subject_id' => $this->subject->id,
            'course_id' => $this->course->id,
            'difficulty' => 'Medium',
        ]);

        // Questions hang off the new server set id (mapped from local set_id=1).
        $this->assertDatabaseHas('questions', ['set_id' => $serverSetId, 'text' => 'Q1']);
        $this->assertEquals(2, DB::table('questions')->where('set_id', $serverSetId)->count());
        $this->assertEquals(3, DB::table('options')->count());

        // The attempt resolved session, question, and selected option ids.
        $attempt = DB::table('attempts')->first();
        $this->assertNotNull($attempt->session_id);
        $this->assertNotNull($attempt->question_id);
        $this->assertNotNull($attempt->selected_option_id);
        $this->assertEquals(1, (int) $attempt->is_correct);

        $this->assertDatabaseHas('app_usage', [
            'device_id' => 'device-A', 'date' => '2026-05-29', 'seconds_active' => 300,
        ]);
        $this->assertDatabaseHas('sync_logs', ['device_id' => 'device-A', 'status' => 'success']);
    }

    public function test_pull_returns_reference_data_in_client_shape(): void
    {
        $res = $this->withHeaders($this->auth())
            ->getJson('/api/sync/pull?since=')
            ->assertOk();

        $res->assertJsonStructure([
            'server_time',
            'subjects' => [['server_id', 'name']],
            'courses' => [['server_id', 'name', 'exam_type', 'subject_server_ids']],
        ]);

        $this->assertEquals($this->subject->id, $res->json('subjects.0.server_id'));
        $this->assertContains($this->subject->id, $res->json('courses.0.subject_server_ids'));
    }

    public function test_restore_returns_full_flat_dataset(): void
    {
        // Seed one set via push so there is data to restore.
        $this->test_push_upserts_flat_payload_and_resolves_foreign_keys();

        $res = $this->withHeaders($this->auth())
            ->getJson('/api/restore')
            ->assertOk();

        $res->assertJsonStructure([
            'subjects', 'courses', 'course_subjects',
            'question_sets', 'questions', 'options',
            'sessions', 'attempts', 'analytics', 'app_usage',
        ]);

        $this->assertCount(1, $res->json('question_sets'));
        $this->assertCount(2, $res->json('questions'));
        $this->assertCount(3, $res->json('options'));
        $this->assertCount(1, $res->json('sessions'));
        $this->assertCount(1, $res->json('attempts'));
        $this->assertCount(1, $res->json('course_subjects'));
        $this->assertEquals(
            $this->course->id,
            $res->json('course_subjects.0.course_server_id')
        );
    }

    public function test_analytics_summary_reflects_synced_data(): void
    {
        $this->test_push_upserts_flat_payload_and_resolves_foreign_keys();

        $res = $this->withHeaders($this->auth())
            ->getJson('/api/analytics/summary')
            ->assertOk();

        $res->assertJson([
            'tests_taken' => 1,
            'questions_attempted' => 1,
            'correct' => 1,
            'wrong' => 0,
            'accuracy' => 100,
        ]);
    }

    public function test_admin_routes_are_forbidden_for_students(): void
    {
        $this->withHeaders($this->auth())
            ->getJson('/api/admin/users')
            ->assertForbidden();
    }
}
