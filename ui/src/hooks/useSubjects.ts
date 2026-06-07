import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import * as subjectsApi from '@/api/subjects';
import type {SubjectPayload} from '@/api/subjects';

const KEY = ['subjects'];

export function useSubjects() {
  return useQuery({queryKey: KEY, queryFn: subjectsApi.listSubjects});
}

export function useSubjectMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({queryKey: KEY});
    // Course rows show subject chips / counts, so refresh them too.
    void qc.invalidateQueries({queryKey: ['courses']});
  };

  const create = useMutation({
    mutationFn: (payload: SubjectPayload) => subjectsApi.createSubject(payload),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({id, payload}: {id: number; payload: SubjectPayload}) =>
      subjectsApi.updateSubject(id, payload),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => subjectsApi.deleteSubject(id),
    onSuccess: invalidate,
  });

  return {create, update, remove};
}
