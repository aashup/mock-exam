import {z} from 'zod';
import type {Difficulty, TestLanguage} from './models';

/** Parameters used to build a generation prompt. */
export interface GenerationParams {
  subject: string;
  /** Optional — questions depend primarily on the subject. */
  course?: string | null;
  difficulty: Difficulty;
  count: number;
  /** Language to generate the questions in. Defaults to English. */
  language?: TestLanguage;
}

/**
 * Zod schema for the AI response. The AI is asked to return a JSON array of
 * questions; we validate strictly so malformed responses are rejected before
 * they touch the database.
 */
export const AIOptionSchema = z.object({
  text: z.string().min(1),
  is_correct: z.boolean(),
});

export const AIQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(AIOptionSchema).min(2).max(6),
  explanation: z.string().optional().default(''),
});

export const AIResponseSchema = z.array(AIQuestionSchema).min(1);

export type AIQuestion = z.infer<typeof AIQuestionSchema>;
export type AIResponse = z.infer<typeof AIResponseSchema>;

/** Common interface implemented by every AI provider adapter. */
export interface AIQuestionGenerator {
  readonly provider: 'gemini' | 'chatgpt';
  generate(params: GenerationParams, apiKey: string, model: string): Promise<AIResponse>;
}
