import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import * as qsApi from '@/api/questionSets';
import type {ImportPayload} from '@/api/questionSets';

const KEY = ['question-sets'];

export function useQuestionSets() {
  return useQuery({queryKey: KEY, queryFn: qsApi.listQuestionSets});
}

export function useQuestionSetMutations() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({queryKey: KEY});

  const importSet = useMutation({
    mutationFn: (payload: ImportPayload) => qsApi.importQuestionSet(payload),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => qsApi.deleteQuestionSet(id),
    onSuccess: invalidate,
  });

  return {importSet, remove};
}
