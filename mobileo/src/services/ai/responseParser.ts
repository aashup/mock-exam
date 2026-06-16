import {AIResponseSchema, type AIResponse} from '@/types/ai';
import {stripCodeFences} from './promptBuilder';

/**
 * Parses and validates raw model text into a typed AIResponse.
 * Throws a descriptive error if the payload is not the expected JSON array.
 */
export function parseAIResponse(raw: string): AIResponse {
  const cleaned = stripCodeFences(raw);

  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    // Some models prepend prose — try to extract the first JSON array.
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) {
      throw new Error('AI response was not valid JSON.');
    }
    json = JSON.parse(match[0]);
  }

  const result = AIResponseSchema.safeParse(json);
  if (!result.success) {
    throw new Error(`AI response failed validation: ${result.error.message}`);
  }

  // Guarantee exactly one correct option per question.
  for (const q of result.data) {
    const correct = q.options.filter(o => o.is_correct).length;
    if (correct !== 1) {
      throw new Error(`Question "${q.question}" must have exactly one correct option.`);
    }
  }

  return result.data;
}
