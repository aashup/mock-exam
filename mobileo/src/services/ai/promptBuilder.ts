import type {GenerationParams} from '@/types/ai';

/**
 * Builds the generation prompt. Subject is the PRIMARY focus; course is only
 * optional framing context. The model is instructed to return a strict JSON
 * array which we validate with zod before persisting.
 */
export function buildPrompt(params: GenerationParams): string {
  const course = params.course?.trim() || 'general';
  const languageName = params.language === 'hi' ? 'Hindi (हिन्दी, Devanagari script)' : 'English';
  return [
    `Generate ${params.count} multiple-choice questions.`,
    `PRIMARY topic — Subject: ${params.subject}   (focus the questions here)`,
    `Secondary context — Course/Exam Type: ${course}   (optional framing only)`,
    `Difficulty: ${params.difficulty}`,
    `Language: write every question, option, and explanation entirely in ${languageName}.`,
    '',
    'For each question return an object of this exact shape:',
    '{',
    '  "question": "...",',
    '  "options": [',
    '    { "text": "...", "is_correct": false },',
    '    { "text": "...", "is_correct": true }',
    '  ],',
    '  "explanation": "..."',
    '}',
    '',
    'Rules:',
    '- Exactly one option must have "is_correct": true.',
    '- Provide 4 options per question unless the topic is naturally true/false.',
    `- All question, option, and explanation text MUST be written in ${languageName}.`,
    '- The JSON keys ("question", "options", "text", "is_correct", "explanation") stay in English.',
    '- Return a JSON array of these objects ONLY. No markdown, no extra text.',
  ].join('\n');
}

/** Strips markdown code fences a model may wrap the JSON in. */
export function stripCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}
