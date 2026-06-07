import {api} from './client';
import type {Difficulty, ParsedQuestion, QuestionSet} from '@/types/models';

export interface ImportPayload {
  subject_id: number;
  course_id?: number | null;
  difficulty: Difficulty;
  ai_provider?: string | null;
  prompt_used?: string | null;
  questions: ParsedQuestion[];
}

export async function listQuestionSets(): Promise<QuestionSet[]> {
  const {data} = await api.get<{question_sets: QuestionSet[]}>('/admin/question-sets');
  return data.question_sets;
}

export async function importQuestionSet(payload: ImportPayload): Promise<QuestionSet> {
  const {data} = await api.post<{question_set: QuestionSet}>('/admin/question-sets', payload);
  return data.question_set;
}

export async function deleteQuestionSet(id: number): Promise<void> {
  await api.delete(`/admin/question-sets/${id}`);
}
