import {useEffect, useMemo, useState} from 'react';
import {useSubjects} from '@/hooks/useSubjects';
import {useCourses} from '@/hooks/useCourses';
import {useQuestionSets, useQuestionSetMutations} from '@/hooks/useQuestionSets';
import {buildPrompt, parseResponse} from '@/lib/questionPrompt';
import type {Language} from '@/lib/questionPrompt';
import {PageHeader} from '@/components/PageHeader';
import {Button} from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import {Select} from '@/components/ui/Select';
import {Badge} from '@/components/ui/Badge';
import {Spinner} from '@/components/ui/Spinner';
import {ConfirmDialog} from '@/components/ui/ConfirmDialog';
import {Table, Th, Td, EmptyRow} from '@/components/ui/Table';
import {errorMessage} from '@/api/client';
import type {Difficulty, ParsedQuestion, QuestionSet} from '@/types/models';

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];

export function GenerateQuestionsPage() {
  const {data: subjects} = useSubjects();
  const {data: courses} = useCourses();
  const {data: sets, isLoading: setsLoading} = useQuestionSets();
  const {importSet, remove} = useQuestionSetMutations();

  // Step 1 — config
  const [subjectId, setSubjectId] = useState<number | ''>('');
  const [courseId, setCourseId] = useState<number | ''>('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [count, setCount] = useState(10);
  const [language, setLanguage] = useState<Language>('en');
  const [topics, setTopics] = useState('');

  // Step 3 — paste + parse
  const [pasted, setPasted] = useState('');
  const [parsed, setParsed] = useState<ParsedQuestion[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedMsg, setImportedMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<QuestionSet | null>(null);

  const subject = useMemo(
    () => subjects?.find(s => s.id === subjectId),
    [subjects, subjectId],
  );
  const course = useMemo(() => courses?.find(c => c.id === courseId), [courses, courseId]);

  // When a subject with a stored syllabus is selected, prefill the topics box
  // (the admin can still edit/clear it before generating).
  useEffect(() => {
    if (subject?.topics && subject.topics.length > 0) {
      setTopics(
        subject.topics
          .map(t => (t.description ? `${t.title}: ${t.description}` : t.title))
          .join('\n\n'),
      );
    } else {
      setTopics('');
    }
    // Only react to a change of selected subject, not to user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, subjects]);

  const prompt = useMemo(() => {
    if (!subject) return '';
    return buildPrompt({
      subject: subject.name,
      course: course?.name ?? null,
      difficulty,
      count,
      language,
      topics,
    });
  }, [subject, course, difficulty, count, language, topics]);

  const copyPrompt = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const runParse = () => {
    setImportedMsg(null);
    setImportError(null);
    const result = parseResponse(pasted);
    if (!result.ok) {
      setParsed(null);
      setParseError(result.error ?? 'Could not parse the response.');
      return;
    }
    setParseError(null);
    setParsed(result.questions);
  };

  const doImport = async () => {
    if (!subject || !parsed) return;
    setImportError(null);
    try {
      const created = await importSet.mutateAsync({
        subject_id: subject.id,
        course_id: course?.id ?? null,
        difficulty,
        ai_provider: 'manual',
        prompt_used: prompt,
        questions: parsed,
      });
      setImportedMsg(
        `Imported ${created.questions_count ?? parsed.length} questions into "${subject.name}" (${difficulty}).`,
      );
      // Reset paste/preview but keep the config for another batch.
      setPasted('');
      setParsed(null);
    } catch (err) {
      setImportError(errorMessage(err, 'Could not import questions.'));
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
        title="Generate Questions"
        subtitle="Copy the prompt into your AI model, then paste the JSON response back to import"
      />

      {/* Step 1 — pick context */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">1. Choose what to generate</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            label="Subject *"
            value={subjectId}
            onChange={e => setSubjectId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Select a subject…</option>
            {(subjects ?? []).map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            label="Course (optional)"
            value={courseId}
            onChange={e => setCourseId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">No specific course</option>
            {(courses ?? []).map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            label="Difficulty"
            value={difficulty}
            onChange={e => setDifficulty(e.target.value as Difficulty)}>
            {DIFFICULTIES.map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select
            label="Language"
            value={language}
            onChange={e => setLanguage(e.target.value as Language)}>
            <option value="en">English</option>
            <option value="hi">हिन्दी (Hindi)</option>
          </Select>
          <Input
            label="Number of questions"
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={e => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
          />
        </div>
        <div className="mt-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Topics / Syllabus (optional)
            </span>
            <textarea
              value={topics}
              onChange={e => setTopics(e.target.value)}
              placeholder="Paste the syllabus or list specific topics to focus on, e.g.&#10;- Arrays &amp; linked lists&#10;- Sorting algorithms (quick, merge)&#10;- Big-O complexity"
              className="h-28 w-full rounded-lg border border-slate-300 p-3 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <p className="mt-1 text-xs text-slate-500">
            When provided, the AI is told to restrict questions to these topics only.
          </p>
        </div>
      </section>

      {/* Step 2 — prompt */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">2. Copy this prompt</h2>
          <Button variant="secondary" onClick={copyPrompt} disabled={!prompt}>
            {copied ? 'Copied!' : 'Copy prompt'}
          </Button>
        </div>
        {prompt ? (
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
            {prompt}
          </pre>
        ) : (
          <p className="text-sm text-slate-400">Select a subject above to build the prompt.</p>
        )}
      </section>

      {/* Step 3 — paste response */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">
          3. Paste the AI response (JSON)
        </h2>
        <textarea
          value={pasted}
          onChange={e => setPasted(e.target.value)}
          placeholder='Paste the JSON array the AI returned, e.g. [{"question":"...","options":[...],"explanation":"..."}]'
          className="h-48 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button variant="secondary" onClick={runParse} disabled={!pasted.trim()}>
            Parse &amp; preview
          </Button>
          {parseError && <span className="text-sm text-red-600">{parseError}</span>}
          {parsed && (
            <span className="text-sm text-green-700">
              {parsed.length} question{parsed.length === 1 ? '' : 's'} parsed ✓
            </span>
          )}
        </div>
      </section>

      {/* Step 4 — preview + import */}
      {parsed && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">4. Review &amp; import</h2>
            <Button
              onClick={doImport}
              loading={importSet.isPending}
              disabled={!subject || parsed.length === 0}>
              Import {parsed.length} question{parsed.length === 1 ? '' : 's'}
            </Button>
          </div>
          {!subject && (
            <p className="mb-3 text-sm text-amber-700">Pick a subject in step 1 before importing.</p>
          )}
          {importError && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{importError}</p>
          )}
          <ol className="space-y-4">
            {parsed.map((q, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-4">
                <p className="mb-2 font-medium text-slate-800">
                  {i + 1}. {q.question}
                </p>
                <ul className="space-y-1">
                  {q.options.map((o, j) => (
                    <li
                      key={j}
                      className={`rounded px-2 py-1 text-sm ${
                        o.is_correct
                          ? 'bg-green-50 font-medium text-green-800'
                          : 'text-slate-600'
                      }`}>
                      {o.is_correct ? '✓ ' : '• '}
                      {o.text}
                    </li>
                  ))}
                </ul>
                {q.explanation && (
                  <p className="mt-2 text-xs text-slate-500">
                    <span className="font-medium">Explanation:</span> {q.explanation}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {importedMsg && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">{importedMsg}</p>
      )}

      {/* Imported sets */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Imported question sets</h2>
        {setsLoading ? (
          <Spinner />
        ) : (
          <Table
            head={
              <>
                <Th>Subject</Th>
                <Th>Course</Th>
                <Th>Difficulty</Th>
                <Th>Questions</Th>
                <Th>Imported</Th>
                <Th className="text-right">Actions</Th>
              </>
            }>
            {sets && sets.length > 0 ? (
              sets.map(s => (
                <tr key={s.id}>
                  <Td className="font-medium text-slate-800">{s.subject?.name ?? '—'}</Td>
                  <Td>{s.course?.name ?? <span className="text-slate-400">—</span>}</Td>
                  <Td>
                    <Badge color="brand">{s.difficulty}</Badge>
                  </Td>
                  <Td>{s.questions_count ?? s.total_questions}</Td>
                  <Td className="text-xs text-slate-500">
                    {s.generated_at ? new Date(s.generated_at).toLocaleString() : '—'}
                  </Td>
                  <Td className="text-right">
                    <Button variant="ghost" onClick={() => setDeleting(s)}>
                      Delete
                    </Button>
                  </Td>
                </tr>
              ))
            ) : (
              <EmptyRow colSpan={6} message="No question sets imported yet." />
            )}
          </Table>
        )}
      </section>

      <ConfirmDialog
        open={deleting != null}
        title="Delete question set"
        message={`Delete this ${deleting?.difficulty ?? ''} set for "${deleting?.subject?.name ?? ''}"? This removes its questions too.`}
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
