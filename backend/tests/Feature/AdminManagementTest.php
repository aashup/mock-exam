<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Admin management surface: an admin adds subjects and courses, then attaches
 * subjects to a course via the M2M pivot. Also guards the role:admin gate so a
 * student can never reach these endpoints.
 */
class AdminManagementTest extends TestCase
{
    use RefreshDatabase;

    private function adminToken(): string
    {
        $admin = User::factory()->admin()->create();

        return $admin->createToken('test')->plainTextToken;
    }

    public function test_admin_can_add_subjects(): void
    {
        $token = $this->adminToken();

        $this->withToken($token)->postJson('/api/admin/subjects', ['name' => 'Algebra'])
            ->assertCreated()
            ->assertJsonPath('subject.name', 'Algebra');

        $this->assertDatabaseHas('subjects', ['name' => 'Algebra']);
    }

    public function test_admin_can_add_courses(): void
    {
        $token = $this->adminToken();

        $this->withToken($token)->postJson('/api/admin/courses', [
            'name' => 'SSC CGL',
            'exam_type' => 'Government',
        ])
            ->assertCreated()
            ->assertJsonPath('course.name', 'SSC CGL')
            ->assertJsonPath('course.exam_type', 'Government');

        $this->assertDatabaseHas('courses', ['name' => 'SSC CGL', 'exam_type' => 'Government']);
    }

    public function test_admin_can_attach_subjects_to_a_course(): void
    {
        $token = $this->adminToken();

        // Add two subjects + a course first.
        $algebra = Subject::create(['name' => 'Algebra']);
        $geometry = Subject::create(['name' => 'Geometry']);
        $course = Course::create(['name' => 'SSC CGL', 'exam_type' => 'Government']);

        // Attach both subjects to the course via the pivot endpoint.
        $this->withToken($token)
            ->postJson("/api/admin/courses/{$course->id}/subjects", [
                'subject_ids' => [$algebra->id, $geometry->id],
            ])
            ->assertOk()
            ->assertJsonCount(2, 'course.subjects');

        $this->assertDatabaseHas('course_subject', [
            'course_id' => $course->id,
            'subject_id' => $algebra->id,
        ]);
        $this->assertDatabaseHas('course_subject', [
            'course_id' => $course->id,
            'subject_id' => $geometry->id,
        ]);
    }

    public function test_attach_replaces_the_existing_subject_set(): void
    {
        $token = $this->adminToken();

        $a = Subject::create(['name' => 'Algebra']);
        $b = Subject::create(['name' => 'Geometry']);
        $course = Course::create(['name' => 'SSC CGL']);
        $course->subjects()->sync([$a->id]);

        // Sync to a new set — old link removed, new one added.
        $this->withToken($token)
            ->postJson("/api/admin/courses/{$course->id}/subjects", [
                'subject_ids' => [$b->id],
            ])
            ->assertOk()
            ->assertJsonCount(1, 'course.subjects');

        $this->assertDatabaseMissing('course_subject', [
            'course_id' => $course->id,
            'subject_id' => $a->id,
        ]);
        $this->assertDatabaseHas('course_subject', [
            'course_id' => $course->id,
            'subject_id' => $b->id,
        ]);
    }

    public function test_attached_subjects_surface_via_reference_endpoint(): void
    {
        $token = $this->adminToken();

        $algebra = Subject::create(['name' => 'Algebra']);
        $course = Course::create(['name' => 'SSC CGL']);
        $course->subjects()->sync([$algebra->id]);

        // The student-facing reference endpoint should report the linked course.
        $this->withToken($token)
            ->getJson("/api/subjects/{$algebra->id}/courses")
            ->assertOk()
            ->assertJsonFragment(['name' => 'SSC CGL']);
    }

    public function test_student_cannot_reach_admin_endpoints(): void
    {
        $student = User::factory()->create(); // role = student
        $token = $student->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/admin/subjects', ['name' => 'Nope'])
            ->assertForbidden();

        $this->assertDatabaseMissing('subjects', ['name' => 'Nope']);
    }

    public function test_duplicate_subject_name_is_rejected(): void
    {
        $token = $this->adminToken();
        Subject::create(['name' => 'Algebra']);

        $this->withToken($token)->postJson('/api/admin/subjects', ['name' => 'Algebra'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }
}
