<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OcrController extends Controller
{
    // The strict instructions for the AI
    private $systemPrompt = "You are an expert educational data parser. Analyze the provided Devanagari text, identify multiple-choice questions, and structure them into a JSON array.

    Rules:
    1. Extract the question text.
    2. Extract exactly 4 options per question.
    3. Fix obvious OCR typos in Devanagari.
    4. Set 'is_correct': true for the correct option (use internet for search the correct answer).
    5. Output ONLY valid JSON array of matching questions and there options, matching the schema below.
    
    Schema:
    {
      \"questions\": [
        {
          \"question\": \"Question text\",
          \"options\": [
            { \"text\": \"Option 1\", \"is_correct\": false },
            { \"text\": \"Option 2\", \"is_correct\": false },
            { \"text\": \"Option 3\", \"is_correct\": false },
            { \"text\": \"Option 4\", \"is_correct\": false }
          ]
        }
      ]
    }";

    public function analyze(Request $request)
    {
        // 1. Validate the incoming text from the mobile app
        $request->validate([
            'rawText' => 'required|string',
        ]);

        try {
            // 2. Send the request to your local Ollama engine
            // Note: If Ollama is on a different server, change 'localhost' to its IP
            $response = Http::timeout(120)->post('http://host.docker.internal:11434/api/chat', [
                'model' => 'qwen2.5:3b',
                'messages' => [
                    ['role' => 'system', 'content' => $this->systemPrompt],
                    ['role' => 'user', 'content' => $request->rawText],
                ],
                'format' => 'json', // Forces strict JSON output
                'stream' => false,
            ]);

            if ($response->failed()) {
                Log::error('Ollama Error: ' . $response->body());
                return response()->json(['error' => 'AI generation failed'], 500);
            }

            // 3. Extract and parse the AI's JSON response
            $aiResponseText = $response->json('message.content');
            $parsedData = json_decode($aiResponseText, true);

            // 4. Return it to the mobile app
            return response()->json($parsedData);

        } catch (\Exception $e) {
            Log::error('OCR Controller Exception: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to process text'], 500);
        }
    }
}