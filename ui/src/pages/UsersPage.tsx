import {useState} from 'react';
import {useUsers} from '@/hooks/useAdminData';
import {PageHeader} from '@/components/PageHeader';
import {Spinner} from '@/components/ui/Spinner';
import {Badge} from '@/components/ui/Badge';
import {Button} from '@/components/ui/Button';
import {Table, Th, Td, EmptyRow} from '@/components/ui/Table';

export function UsersPage() {
  const [page, setPage] = useState(1);
  const {data, isLoading, isFetching} = useUsers(page);

  return (
    <div>
      <PageHeader title="Users" subtitle="Registered students and admins" />

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <Table
            head={
              <>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Tests</Th>
                <Th>Sets</Th>
                <Th>Last sync</Th>
              </>
            }>
            {data && data.data.length > 0 ? (
              data.data.map(u => (
                <tr key={u.id}>
                  <Td className="font-medium text-slate-800">{u.name}</Td>
                  <Td>{u.email}</Td>
                  <Td>
                    <Badge color={u.role === 'admin' ? 'amber' : 'slate'}>{u.role}</Badge>
                  </Td>
                  <Td>{u.sessions_count ?? 0}</Td>
                  <Td>{u.question_sets_count ?? 0}</Td>
                  <Td>{u.last_sync_at ? new Date(u.last_sync_at).toLocaleString() : '—'}</Td>
                </tr>
              ))
            ) : (
              <EmptyRow colSpan={6} message="No users found." />
            )}
          </Table>

          {data && data.last_page > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span>
                Page {data.current_page} of {data.last_page} · {data.total} users
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= data.last_page || isFetching}
                  onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
