import {useApiUsage} from '@/hooks/useAdminData';
import {PageHeader} from '@/components/PageHeader';
import {Spinner} from '@/components/ui/Spinner';
import {Table, Th, Td, EmptyRow} from '@/components/ui/Table';

export function ApiUsagePage() {
  const {data, isLoading} = useApiUsage();

  return (
    <div>
      <PageHeader title="API Usage" subtitle="AI token consumption per user & provider" />

      {isLoading ? (
        <Spinner />
      ) : (
        <Table
          head={
            <>
              <Th>User</Th>
              <Th>Provider</Th>
              <Th>Prompt tokens</Th>
              <Th>Completion tokens</Th>
              <Th>Questions generated</Th>
            </>
          }>
          {data && data.length > 0 ? (
            data.map((row, i) => (
              <tr key={`${row.user_id}-${row.provider}-${i}`}>
                <Td className="font-medium text-slate-800">{row.email}</Td>
                <Td className="capitalize">{row.provider}</Td>
                <Td>{Number(row.prompt_tokens).toLocaleString()}</Td>
                <Td>{Number(row.completion_tokens).toLocaleString()}</Td>
                <Td>{Number(row.questions_generated).toLocaleString()}</Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={5} message="No API usage recorded yet." />
          )}
        </Table>
      )}
    </div>
  );
}
