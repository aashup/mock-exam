import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import * as qApi from '@/api/questions';
import type {QuestionPayload} from '@/api/questions';

const key = (setId: number) => ['questions', setId];

/** Questions (with options) for a single set; disabled until a set is chosen. */
export function useQuestions(setId: number | null) {
  return useQuery({
    queryKey: key(setId ?? 0),
    queryFn: () => qApi.listQuestions(setId as number),
    enabled: setId != null,
  });
}

export function useQuestionMutations(setId: number | null) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({queryKey: key(setId ?? 0)});
    // The set's question count changed → refresh the sets table too.
    void qc.invalidateQueries({queryKey: ['question-sets']});
  };

  const create = useMutation({
    mutationFn: (payload: QuestionPayload) =>
      qApi.createQuestion(setId as number, payload),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({id, payload}: {id: number; payload: QuestionPayload}) =>
      qApi.updateQuestion(id, payload),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => qApi.deleteQuestion(id),
    onSuccess: invalidate,
  });

  return {create, update, remove};
}
