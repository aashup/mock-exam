<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Subject;

/**
 * Read-only reference data consumed by the mobile app on launch + each sync.
 */
class ReferenceController extends Controller
{
    public function subjects()
    {
        $subjects = Subject::orderBy('name')->get()->map(fn ($s) => [
            'server_id' => $s->id,
            'name' => $s->name,
        ]);

        return response()->json(['subjects' => $subjects]);
    }

    public function courses()
    {
        $courses = Course::with('subjects:id')->orderBy('name')->get()->map(fn ($c) => [
            'server_id' => $c->id,
            'name' => $c->name,
            'exam_type' => $c->exam_type,
            'subject_server_ids' => $c->subjects->pluck('id'),
        ]);

        return response()->json(['courses' => $courses]);
    }

    public function coursesForSubject(Subject $subject)
    {
        return response()->json([
            'courses' => $subject->courses()->orderBy('name')->get(),
        ]);
    }
}
