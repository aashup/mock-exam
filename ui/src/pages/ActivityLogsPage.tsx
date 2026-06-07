import {useState} from 'react';
import {useActivityLogs} from '@/hooks/useAdminData';
import {PageHeader} from '@/components/PageHeader';
import {Spinner} from '@/components/ui/Spinner';
import {Button} from '@/components/ui/Button';
import {Table, Th, Td, EmptyRow} from '@/components/ui/Table';

export function ActivityLogsPage() {
  const [page, setPage] = useState(1);
  const {data, isLoading, isFetching} = useActivityLogs(page);

  return (
    <div>
      <PageHeader title="Activity Logs" subtitle="Recent user actions across the platform" />

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <Table
            head={
              <>
                <Th>When</Th>
                <Th>User</Th>
                <Th>Action</Th>
                <Th>Metadata</Th>
              </>
            }>
            {data && data.data.length > 0 ? (
              data.data.map(log => (
                <tr key={log.id}>
                  <Td>{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</Td>
                  <Td>{log.user_id ?? '—'}</Td>
                  <Td className="font-medium text-slate-800">{log.action}</Td>
                  <Td className="max-w-md truncate text-xs text-slate-500">{log.metadata ?? '—'}</Td>
                </tr>
              ))
            ) : (
              <EmptyRow colSpan={4} message="No activity logged yet." />
            )}
          </Table>

          {data && data.last_page > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span>
                Page {data.current_page} of {data.last_page} · {data.total} entries
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
