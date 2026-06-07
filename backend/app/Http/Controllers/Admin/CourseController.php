<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use Illuminate\Http\Request;

class CourseController extends Controller
{
    public function index()
    {
        return response()->json([
            'courses' => Course::with('subjects:id,name')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'exam_type' => ['nullable', 'string', 'max:255'],
            'subject_ids' => ['array'],
            'subject_ids.*' => ['uuid', 'exists:subjects,id'],
        ]);

        $course = Course::create([
            'name' => $data['name'],
            'exam_type' => $data['exam_type'] ?? null,
        ]);

        if (! empty($data['subject_ids'])) {
            $course->subjects()->sync($data['subject_ids']);
        }

        return response()->json(['course' => $course->load('subjects:id,name')], 201);
    }

    public function update(Request $request, Course $course)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'exam_type' => ['nullable', 'string', 'max:255'],
            'subject_ids' => ['array'],
            'subject_ids.*' => ['uuid', 'exists:subjects,id'],
        ]);

        $course->update([
            'name' => $data['name'],
            'exam_type' => $data['exam_type'] ?? null,
        ]);

        if ($request->has('subject_ids')) {
            $course->subjects()->sync($data['subject_ids']);
        }

        return response()->json(['course' => $course->load('subjects:id,name')]);
    }

    public function destroy(Course $course)
    {
        $course->delete();

        return response()->json(['message' => 'Course deleted.']);
    }

    /**
     * POST /api/admin/courses/{course}/subjects — sync M2M subject links.
     */
    public function syncSubjects(Request $request, Course $course)
    {
        $data = $request->validate([
            'subject_ids' => ['required', 'array'],
            'subject_ids.*' => ['uuid', 'exists:subjects,id'],
        ]);

        $course->subjects()->sync($data['subject_ids']);

        return response()->json(['course' => $course->load('subjects:id,name')]);
    }
}
