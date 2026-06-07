import {useMemo, useState} from 'react';
import {useQuestionSets} from '@/hooks/useQuestionSets';
import {useQuestions, useQuestionMutations} from '@/hooks/useQuestions';
import type {QuestionPayload} from '@/api/questions';
import {PageHeader} from '@/components/PageHeader';
import {Button} from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import {Select} from '@/components/ui/Select';
import {Modal} from '@/components/ui/Modal';
import {Badge} from '@/components/ui/Badge';
import {Spinner} from '@/components/ui/Spinner';
import {ConfirmDialog} from '@/components/ui/ConfirmDialog';
import {Table, Th, Td, EmptyRow} from '@/components/ui/Table';
import {errorMessage} from '@/api/client';
import type {Question, QuestionSet} from '@/types/models';

interface DraftOption {
  text: string;
  is_correct: boolean;
}

interface Draft {
  text: string;
  explanation: string;
  options: DraftOption[];
}

const emptyDraft = (): Draft => ({
  text: '',
  explanation: '',
  options: [
    {text: '', is_correct: true},
    {text: '', is_correct: false},
  ],
});

const setLabel = (s: QuestionSet) =>
  `${s.subject?.name ?? 'Subject #' + s.subject_id} · ${s.difficulty}` +
  (s.course?.name ? ` · ${s.course.name}` : '') +
  ` (${s.questions_count ?? s.total_questions} Qs)`;

export function QuestionsPage() {
  const {data: sets, isLoading: setsLoading} = useQuestionSets();
  const [setId, setSetId] = useState<number | null>(null);

  const {data, isLoading} = useQuestions(setId);
  const {create, update, remove} = useQuestionMutations(setId);

  const [editing, setEditing] = useState<Question | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Question | null>(null);

  const saving = create.isPending || update.isPending;
  const questions = data?.questions ?? [];

  const selectedSet = useMemo(
    () => sets?.find(s => s.id === setId) ?? null,
    [sets, setId],
  );

  const openNew = () => {
    setDraft(emptyDraft());
    setFormError(null);
    setEditing('new');
  };

  const openEdit = (q: Question) => {
    setDraft({
      text: q.text,
      explanation: q.explanation ?? '',
      options: q.options.map(o => ({text: o.text, is_correct: o.is_correct})),
    });
    setFormError(null);
    setEditing(q);
  };

  const closeModal = () => {
    setEditing(null);
    setFormError(null);
  };

  // ---- draft option helpers ----
  const setOptionText = (i: number, text: string) =>
    setDraft(d => ({
      ...d,
      options: d.options.map((o, j) => (j === i ? {...o, text} : o)),
    }));

  const setCorrect = (i: number) =>
    setDraft(d => ({
      ...d,
      options: d.options.map((o, j) => ({...o, is_correct: j === i})),
    }));

  const addOption = () =>
    setDraft(d => ({...d, options: [...d.options, {text: '', is_correct: false}]}));

  const removeOption = (i: number) =>
    setDraft(d => {
      const options = d.options.filter((_, j) => j !== i);
      // Ensure at least one option stays marked correct.
      if (!options.some(o => o.is_correct) && options.length > 0) {
        options[0].is_correct = true;
      }
      return {...d, options};
    });

  const save = async () => {
    setFormError(null);

    const text = draft.text.trim();
    const options = draft.options
      .map(o => ({text: o.text.trim(), is_correct: o.is_correct}))
      .filter(o => o.text.length > 0);

    if (!text) {
      setFormError('Question text is required.');
      return;
    }
    if (options.length < 2) {
      setFormError('Add at least two non-empty options.');
      return;
    }
    if (options.filter(o => o.is_correct).length !== 1) {
      setFormError('Mark exactly one option as correct.');
      return;
    }

    const payload: QuestionPayload = {
      text,
      explanation: draft.explanation.trim() || null,
      options,
    };

    try {
      if (editing === 'new') {
        await create.mutateAsync(payload);
      } else if (editing) {
        await update.mutateAsync({id: editing.id, payload});
      }
      closeModal();
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save the question.'));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Questions"
        subtitle="Browse, add, edit and delete questions (with their options) in any set"
        action={
          <Button onClick={openNew} disabled={setId == null}>
            Add question
          </Button>
        }
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        {setsLoading ? (
          <Spinner />
        ) : (
          <Select
            label="Question set"
            value={setId ?? ''}
            onChange={e => setSetId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Select a question set…</option>
            {(sets ?? []).map(s => (
              <option key={s.id} value={s.id}>
                {setLabel(s)}
              </option>
            ))}
          </Select>
        )}
      </section>

      {setId == null ? (
        <p className="text-sm text-slate-400">
          Choose a question set above to manage its questions.
        </p>
      ) : isLoading ? (
        <Spinner />
      ) : (
        <Table
          head={
            <>
              <Th className="w-12">#</Th>
              <Th>Question</Th>
              <Th>Options</Th>
              <Th className="text-right">Actions</Th>
            </>
          }>
          {questions.length > 0 ? (
            questions.map((q, i) => (
              <tr key={q.id}>
                <Td className="text-slate-400">{i + 1}</Td>
                <Td className="max-w-md font-medium text-slate-800">
                  {q.text}
                  {q.explanation && (
                    <p className="mt-1 text-xs font-normal text-slate-500">
                      {q.explanation}
                    </p>
                  )}
                </Td>
                <Td>
                  <ul className="space-y-1">
                    {q.options.map(o => (
                      <li
                        key={o.id}
                        className={`text-sm ${
                          o.is_correct ? 'font-medium text-green-700' : 'text-slate-600'
                        }`}>
                        {o.is_correct ? '✓ ' : '• '}
                        {o.text}
                      </li>
                    ))}
                  </ul>
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" onClick={() => openEdit(q)}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => setDeleting(q)}>
                      Delete
                    </Button>
                  </div>
                </Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={4} message="No questions in this set yet." />
          )}
        </Table>
      )}

      <Modal
        open={editing != null}
        title={editing === 'new' ? 'Add question' : 'Edit question'}
        onClose={closeModal}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </>
        }>
        <div className="space-y-4">
          {selectedSet && (
            <Badge color="brand">{selectedSet.difficulty}</Badge>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Question text
            </span>
            <textarea
              value={draft.text}
              onChange={e => setDraft(d => ({...d, text: e.target.value}))}
              className="h-24 w-full rounded-lg border border-slate-300 p-3 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">
                Options (select the correct one)
              </span>
              <Button variant="ghost" onClick={addOption}>
                + Add option
              </Button>
            </div>
            <div className="space-y-2">
              {draft.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct-option"
                    checked={o.is_correct}
                    onChange={() => setCorrect(i)}
                    className="h-4 w-4 text-brand-600"
                    aria-label={`Mark option ${i + 1} correct`}
                  />
                  <Input
                    className="flex-1"
                    placeholder={`Option ${i + 1}`}
                    value={o.text}
                    onChange={e => setOptionText(i, e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    onClick={() => removeOption(i)}
                    disabled={draft.options.length <= 2}
                    aria-label={`Remove option ${i + 1}`}>
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Explanation (optional)
            </span>
            <textarea
              value={draft.explanation}
              onChange={e => setDraft(d => ({...d, explanation: e.target.value}))}
              className="h-20 w-full rounded-lg border border-slate-300 p-3 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting != null}
        title="Delete question"
        message="Delete this question and all of its options? This cannot be undone."
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
