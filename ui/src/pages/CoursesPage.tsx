import {useMemo, useState} from 'react';
import {useCourses, useCourseMutations} from '@/hooks/useCourses';
import {useSubjects} from '@/hooks/useSubjects';
import {PageHeader} from '@/components/PageHeader';
import {Button} from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import {Modal} from '@/components/ui/Modal';
import {MultiSelect} from '@/components/ui/MultiSelect';
import {ConfirmDialog} from '@/components/ui/ConfirmDialog';
import {Spinner} from '@/components/ui/Spinner';
import {Badge} from '@/components/ui/Badge';
import {Table, Th, Td, EmptyRow} from '@/components/ui/Table';
import {errorMessage} from '@/api/client';
import type {Course} from '@/types/models';

export function CoursesPage() {
  const {data: courses, isLoading} = useCourses();
  const {data: subjects} = useSubjects();
  const {create, update, remove} = useCourseMutations();

  const [editing, setEditing] = useState<Course | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [examType, setExamType] = useState('');
  const [subjectIds, setSubjectIds] = useState<number[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Course | null>(null);

  const subjectOptions = useMemo(
    () => (subjects ?? []).map(s => ({value: s.id, label: s.name})),
    [subjects],
  );

  const openCreate = () => {
    setEditing(null);
    setName('');
    setExamType('');
    setSubjectIds([]);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditing(course);
    setName(course.name);
    setExamType(course.exam_type ?? '');
    setSubjectIds(course.subjects.map(s => s.id));
    setFormError(null);
    setModalOpen(true);
  };

  const save = async () => {
    setFormError(null);
    const payload = {
      name: name.trim(),
      exam_type: examType.trim() || null,
      subject_ids: subjectIds,
    };
    try {
      if (editing) {
        await update.mutateAsync({id: editing.id, payload});
      } else {
        await create.mutateAsync(payload);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save course.'));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) {
      return;
    }
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      setDeleting(null);
    }
  };

  const saving = create.isPending || update.isPending;

  return (
    <div>
      <PageHeader
        title="Courses"
        subtitle="Optional exam context — attach the subjects each course covers"
        action={<Button onClick={openCreate}>+ Add course</Button>}
      />

      {isLoading ? (
        <Spinner />
      ) : (
        <Table
          head={
            <>
              <Th>Name</Th>
              <Th>Exam type</Th>
              <Th>Subjects</Th>
              <Th className="text-right">Actions</Th>
            </>
          }>
          {courses && courses.length > 0 ? (
            courses.map(c => (
              <tr key={c.id}>
                <Td className="font-medium text-slate-800">{c.name}</Td>
                <Td>{c.exam_type ?? <span className="text-slate-400">—</span>}</Td>
                <Td>
                  {c.subjects.length === 0 ? (
                    <span className="text-slate-400">None</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {c.subjects.map(s => (
                        <Badge key={s.id}>{s.name}</Badge>
                      ))}
                    </div>
                  )}
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => openEdit(c)}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => setDeleting(c)}>
                      Delete
                    </Button>
                  </div>
                </Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={4} message="No courses yet. Add your first one." />
          )}
        </Table>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Edit course' : 'Add course'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving} disabled={!name.trim()}>
              {editing ? 'Save changes' : 'Create'}
            </Button>
          </>
        }>
        <div className="space-y-4">
          <Input
            label="Course name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. GATE CS"
            autoFocus
          />
          <Input
            label="Exam type (optional)"
            value={examType}
            onChange={e => setExamType(e.target.value)}
            placeholder="e.g. Engineering"
          />
          <MultiSelect
            label="Attach subjects"
            options={subjectOptions}
            selected={subjectIds}
            onChange={setSubjectIds}
            emptyHint="No subjects yet — create one on the Subjects page."
          />
          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting != null}
        title="Delete course"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
