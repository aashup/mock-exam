<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Subject;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    public function index()
    {
        return response()->json([
            'subjects' => Subject::withCount('courses')
                ->with('topics:id,subject_id,title,description,position')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:subjects,name'],
            'course_ids' => ['array'],
            'course_ids.*' => ['uuid', 'exists:courses,id'],
        ]);

        $subject = Subject::create(['name' => $data['name']]);

        if (! empty($data['course_ids'])) {
            $subject->courses()->sync($data['course_ids']);
        }

        return response()->json(['subject' => $subject->load('courses:id,name')], 201);
    }

    public function update(Request $request, Subject $subject)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:subjects,name,' . $subject->id],
            'course_ids' => ['array'],
            'course_ids.*' => ['uuid', 'exists:courses,id'],
        ]);

        $subject->update(['name' => $data['name']]);

        if ($request->has('course_ids')) {
            $subject->courses()->sync($data['course_ids']);
        }

        return response()->json(['subject' => $subject->load('courses:id,name')]);
    }

    public function destroy(Subject $subject)
    {
        $subject->delete();

        return response()->json(['message' => 'Subject deleted.']);
    }
}
