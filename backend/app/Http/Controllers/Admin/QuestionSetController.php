<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Option;
use App\Models\Question;
use App\Models\QuestionSet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QuestionSetController extends Controller
{
    /**
     * List recently imported question sets (newest first).
     */
    public function index()
    {
        $sets = QuestionSet::query()
            ->with(['subject:id,name', 'course:id,name'])
            ->withCount('questions')
            ->latest('id')
            ->limit(100)
            ->get();

        return response()->json(['question_sets' => $sets]);
    }

    /**
     * Import a set of AI-generated questions (pasted by an admin).
     *
     * Expects the parsed JSON the admin copied from Gemini/ChatGPT, plus the
     * subject/course/difficulty context the prompt was built with.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'subject_id' => ['required', 'uuid', 'exists:subjects,id'],
            'course_id' => ['nullable', 'uuid', 'exists:courses,id'],
            'difficulty' => ['required', 'in:Easy,Medium,Hard'],
            'ai_provider' => ['nullable', 'string', 'max:50'],
            'prompt_used' => ['nullable', 'string'],
            'questions' => ['required', 'array', 'min:1'],
            'questions.*.question' => ['required', 'string'],
            'questions.*.explanation' => ['nullable', 'string'],
            'questions.*.options' => ['required', 'array', 'min:2'],
            'questions.*.options.*.text' => ['required', 'string'],
            'questions.*.options.*.is_correct' => ['required', 'boolean'],
        ]);

        // Each question must have exactly one correct option.
        foreach ($data['questions'] as $i => $q) {
            $correct = collect($q['options'])->where('is_correct', true)->count();
            if ($correct !== 1) {
                throw ValidationException::withMessages([
                    "questions.$i.options" => "Question " . ($i + 1) . " must have exactly one correct option (found {$correct}).",
                ]);
            }
        }

        $set = DB::transaction(function () use ($data, $request) {
            $set = QuestionSet::create([
                'user_id' => $request->user()->id,
                'subject_id' => $data['subject_id'],
                'course_id' => $data['course_id'] ?? null,
                'difficulty' => $data['difficulty'],
                'ai_provider' => $data['ai_provider'] ?? 'manual',
                'prompt_used' => $data['prompt_used'] ?? null,
                'total_questions' => count($data['questions']),
                'generated_at' => now(),
            ]);

            foreach ($data['questions'] as $q) {
                $question = Question::create([
                    'set_id' => $set->id,
                    'text' => $q['question'],
                    'explanation' => $q['explanation'] ?? null,
                ]);

                foreach ($q['options'] as $opt) {
                    Option::create([
                        'question_id' => $question->id,
                        'text' => $opt['text'],
                        'is_correct' => (bool) $opt['is_correct'],
                    ]);
                }
            }

            return $set;
        });

        return response()->json([
            'question_set' => $set->load(['subject:id,name', 'course:id,name'])->loadCount('questions'),
        ], 201);
    }

    public function destroy(QuestionSet $questionSet)
    {
        $questionSet->delete();

        return response()->json(['message' => 'Question set deleted.']);
    }
}
