import {api} from './client';
import type {Course} from '@/types/models';

export interface CoursePayload {
  name: string;
  exam_type?: string | null;
  subject_ids?: number[];
}

export async function listCourses(): Promise<Course[]> {
  const {data} = await api.get<{courses: Course[]}>('/admin/courses');
  return data.courses;
}

export async function createCourse(payload: CoursePayload): Promise<Course> {
  const {data} = await api.post<{course: Course}>('/admin/courses', payload);
  return data.course;
}

export async function updateCourse(id: number, payload: CoursePayload): Promise<Course> {
  const {data} = await api.put<{course: Course}>(`/admin/courses/${id}`, payload);
  return data.course;
}

export async function deleteCourse(id: number): Promise<void> {
  await api.delete(`/admin/courses/${id}`);
}

/** Dedicated pivot-sync endpoint: attach a set of subjects to a course. */
export async function syncCourseSubjects(id: number, subjectIds: number[]): Promise<Course> {
  const {data} = await api.post<{course: Course}>(`/admin/courses/${id}/subjects`, {
    subject_ids: subjectIds,
  });
  return data.course;
}
