import {useMemo, useState} from 'react';
import {useSubjects, useSubjectMutations} from '@/hooks/useSubjects';
import {useCourses} from '@/hooks/useCourses';
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
import type {Subject} from '@/types/models';

export function SubjectsPage() {
  const {data: subjects, isLoading} = useSubjects();
  const {data: courses} = useCourses();
  const {create, update, remove} = useSubjectMutations();

  const [editing, setEditing] = useState<Subject | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [courseIds, setCourseIds] = useState<number[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);

  const courseOptions = useMemo(
    () => (courses ?? []).map(c => ({value: c.id, label: c.name})),
    [courses],
  );

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCourseIds([]);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (subject: Subject) => {
    setEditing(subject);
    setName(subject.name);
    setCourseIds(linkedCourseIdsFor(subject.id));
    setFormError(null);
    setModalOpen(true);
  };

  function linkedCourseIdsFor(subjectId: number): number[] {
    return (courses ?? []).filter(c => c.subjects.some(s => s.id === subjectId)).map(c => c.id);
  }

  const save = async () => {
    setFormError(null);
    const payload = {name: name.trim(), course_ids: courseIds};
    try {
      if (editing) {
        await update.mutateAsync({id: editing.id, payload});
      } else {
        await create.mutateAsync(payload);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save subject.'));
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
        title="Subjects"
        subtitle="The primary driver for question generation"
        action={<Button onClick={openCreate}>+ Add subject</Button>}
      />

      {isLoading ? (
        <Spinner />
      ) : (
        <Table
          head={
            <>
              <Th>Name</Th>
              <Th>Linked courses</Th>
              <Th className="text-right">Actions</Th>
            </>
          }>
          {subjects && subjects.length > 0 ? (
            subjects.map(s => (
              <tr key={s.id}>
                <Td className="font-medium text-slate-800">{s.name}</Td>
                <Td>
                  <Badge color="brand">{s.courses_count ?? 0}</Badge>
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => openEdit(s)}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => setDeleting(s)}>
                      Delete
                    </Button>
                  </div>
                </Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={3} message="No subjects yet. Add your first one." />
          )}
        </Table>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Edit subject' : 'Add subject'}
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
            label="Subject name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Computer Science"
            autoFocus
          />
          <MultiSelect
            label="Attach to courses (optional)"
            options={courseOptions}
            selected={courseIds}
            onChange={setCourseIds}
            emptyHint="No courses yet — create one on the Courses page."
          />
          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting != null}
        title="Delete subject"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
