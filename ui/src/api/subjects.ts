import {api} from './client';
import type {Subject} from '@/types/models';

export interface SubjectPayload {
  name: string;
  course_ids?: number[];
}

export async function listSubjects(): Promise<Subject[]> {
  const {data} = await api.get<{subjects: Subject[]}>('/admin/subjects');
  return data.subjects;
}

export async function createSubject(payload: SubjectPayload): Promise<Subject> {
  const {data} = await api.post<{subject: Subject}>('/admin/subjects', payload);
  return data.subject;
}

export async function updateSubject(id: number, payload: SubjectPayload): Promise<Subject> {
  const {data} = await api.put<{subject: Subject}>(`/admin/subjects/${id}`, payload);
  return data.subject;
}

export async function deleteSubject(id: number): Promise<void> {
  await api.delete(`/admin/subjects/${id}`);
}
