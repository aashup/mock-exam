import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import * as coursesApi from '@/api/courses';
import type {CoursePayload} from '@/api/courses';

const KEY = ['courses'];

export function useCourses() {
  return useQuery({queryKey: KEY, queryFn: coursesApi.listCourses});
}

export function useCourseMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({queryKey: KEY});
    // Subject rows show courses_count, so refresh them too.
    void qc.invalidateQueries({queryKey: ['subjects']});
  };

  const create = useMutation({
    mutationFn: (payload: CoursePayload) => coursesApi.createCourse(payload),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({id, payload}: {id: number; payload: CoursePayload}) =>
      coursesApi.updateCourse(id, payload),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => coursesApi.deleteCourse(id),
    onSuccess: invalidate,
  });

  return {create, update, remove};
}
