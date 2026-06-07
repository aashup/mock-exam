import type {Difficulty, ParsedQuestion} from '@/types/models';

export type Language = 'en' | 'hi';

export interface PromptParams {
  subject: string;
  course?: string | null;
  difficulty: Difficulty;
  count: number;
  language?: Language;
  /** Optional free-text topics/syllabus to scope the questions to. */
  topics?: string | null;
}

/**
 * Builds the AI generation prompt. Subject is the PRIMARY focus; course is only
 * optional framing context. Mirrors the mobile app's promptBuilder so questions
 * imported here match the same shape the app expects.
 */
export function buildPrompt(params: PromptParams): string {
  const course = params.course?.trim() || 'general';
  const topics = params.topics?.trim();
  const languageName =
    params.language === 'hi' ? 'Hindi (हिन्दी, Devanagari script)' : 'English';
  return [
    `Generate ${params.count} multiple-choice questions.`,
    `PRIMARY topic — Subject: ${params.subject}   (focus the questions here)`,
    `Secondary context — Course/Exam Type: ${course}   (optional framing only)`,
    ...(topics
      ? [
          'Restrict the questions to the following topics / syllabus only:',
          topics,
        ]
      : []),
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

export interface ParseResult {
  ok: boolean;
  questions: ParsedQuestion[];
  error?: string;
}

/**
 * Parses + validates the AI response the admin pasted. Returns a friendly error
 * message instead of throwing so the page can surface it inline.
 */
export function parseResponse(raw: string): ParseResult {
  const text = stripCodeFences(raw);
  if (!text) {
    return {ok: false, questions: [], error: 'Paste the AI response first.'};
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {ok: false, questions: [], error: 'Not valid JSON. Make sure you copied the entire response.'};
  }

  if (!Array.isArray(data)) {
    return {ok: false, questions: [], error: 'Expected a JSON array of questions.'};
  }
  if (data.length === 0) {
    return {ok: false, questions: [], error: 'The array is empty — no questions found.'};
  }

  const questions: ParsedQuestion[] = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i] as Record<string, unknown>;
    const label = `Question ${i + 1}`;

    if (!row || typeof row.question !== 'string' || !row.question.trim()) {
      return {ok: false, questions: [], error: `${label}: missing "question" text.`};
    }
    if (!Array.isArray(row.options) || row.options.length < 2) {
      return {ok: false, questions: [], error: `${label}: needs at least 2 options.`};
    }

    const options = [];
    let correct = 0;
    for (let j = 0; j < row.options.length; j++) {
      const opt = row.options[j] as Record<string, unknown>;
      if (!opt || typeof opt.text !== 'string' || !opt.text.trim()) {
        return {ok: false, questions: [], error: `${label}, option ${j + 1}: missing "text".`};
      }
      const isCorrect = opt.is_correct === true;
      if (isCorrect) correct++;
      options.push({text: opt.text, is_correct: isCorrect});
    }

    if (correct !== 1) {
      return {
        ok: false,
        questions: [],
        error: `${label}: must have exactly one correct option (found ${correct}).`,
      };
    }

    questions.push({
      question: row.question,
      options,
      explanation: typeof row.explanation === 'string' ? row.explanation : null,
    });
  }

  return {ok: true, questions};
}
