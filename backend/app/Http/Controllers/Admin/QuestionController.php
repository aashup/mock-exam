<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Option;
use App\Models\Question;
use App\Models\QuestionSet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QuestionController extends Controller
{
    /**
     * List every question (with its options) in a set, oldest first.
     */
    public function index(QuestionSet $questionSet)
    {
        $questions = $questionSet->questions()
            ->with('options:id,question_id,text,is_correct')
            ->orderBy('id')
            ->get(['id', 'set_id', 'text', 'explanation']);

        return response()->json([
            'question_set' => $questionSet->load(['subject:id,name', 'course:id,name']),
            'questions' => $questions,
        ]);
    }

    /**
     * Add a single question (with options) to an existing set.
     */
    public function store(Request $request, QuestionSet $questionSet)
    {
        $data = $this->validatePayload($request);

        $question = DB::transaction(function () use ($data, $questionSet) {
            $question = Question::create([
                'set_id' => $questionSet->id,
                'text' => $data['text'],
                'explanation' => $data['explanation'] ?? null,
            ]);

            foreach ($data['options'] as $opt) {
                Option::create([
                    'question_id' => $question->id,
                    'text' => $opt['text'],
                    'is_correct' => (bool) $opt['is_correct'],
                ]);
            }

            $questionSet->update(['total_questions' => $questionSet->questions()->count()]);

            return $question;
        });

        return response()->json([
            'question' => $question->load('options:id,question_id,text,is_correct'),
        ], 201);
    }

    /**
     * Replace a question's text/explanation and its full set of options.
     */
    public function update(Request $request, Question $question)
    {
        $data = $this->validatePayload($request);

        DB::transaction(function () use ($data, $question) {
            $question->update([
                'text' => $data['text'],
                'explanation' => $data['explanation'] ?? null,
            ]);

            // Replace the option list wholesale — simplest correct approach for
            // an admin editor where options are added/removed/reordered freely.
            $question->options()->delete();
            foreach ($data['options'] as $opt) {
                Option::create([
                    'question_id' => $question->id,
                    'text' => $opt['text'],
                    'is_correct' => (bool) $opt['is_correct'],
                ]);
            }
        });

        return response()->json([
            'question' => $question->fresh()->load('options:id,question_id,text,is_correct'),
        ]);
    }

    public function destroy(Question $question)
    {
        $set = $question->set;
        DB::transaction(function () use ($question, $set) {
            $question->options()->delete();
            $question->delete();
            if ($set) {
                $set->update(['total_questions' => $set->questions()->count()]);
            }
        });

        return response()->json(['message' => 'Question deleted.']);
    }

    /**
     * Shared validation for store/update: question text + at least 2 options,
     * exactly one of which is correct.
     */
    private function validatePayload(Request $request): array
    {
        $data = $request->validate([
            'text' => ['required', 'string'],
            'explanation' => ['nullable', 'string'],
            'options' => ['required', 'array', 'min:2'],
            'options.*.text' => ['required', 'string'],
            'options.*.is_correct' => ['required', 'boolean'],
        ]);

        $correct = collect($data['options'])->where('is_correct', true)->count();
        if ($correct !== 1) {
            throw ValidationException::withMessages([
                'options' => "A question must have exactly one correct option (found {$correct}).",
            ]);
        }

        return $data;
    }
}
