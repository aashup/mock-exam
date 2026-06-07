import {api} from './client';
import type {Question, QuestionSet} from '@/types/models';

/** Payload for adding/editing a question (and its full option list). */
export interface QuestionPayload {
  text: string;
  explanation?: string | null;
  options: {text: string; is_correct: boolean}[];
}

export interface QuestionsResponse {
  question_set: QuestionSet;
  questions: Question[];
}

export async function listQuestions(setId: number): Promise<QuestionsResponse> {
  const {data} = await api.get<QuestionsResponse>(
    `/admin/question-sets/${setId}/questions`,
  );
  return data;
}

export async function createQuestion(
  setId: number,
  payload: QuestionPayload,
): Promise<Question> {
  const {data} = await api.post<{question: Question}>(
    `/admin/question-sets/${setId}/questions`,
    payload,
  );
  return data.question;
}

export async function updateQuestion(
  id: number,
  payload: QuestionPayload,
): Promise<Question> {
  const {data} = await api.put<{question: Question}>(`/admin/questions/${id}`, payload);
  return data.question;
}

export async function deleteQuestion(id: number): Promise<void> {
  await api.delete(`/admin/questions/${id}`);
}
