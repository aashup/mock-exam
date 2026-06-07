import {useState} from 'react';
import {useDeviceLocations} from '@/hooks/useAdminData';
import {PageHeader} from '@/components/PageHeader';
import {Spinner} from '@/components/ui/Spinner';
import {Badge} from '@/components/ui/Badge';
import {Button} from '@/components/ui/Button';
import {Table, Th, Td, EmptyRow} from '@/components/ui/Table';

const SOURCE_COLORS: Record<string, 'slate' | 'amber' | 'green'> = {
  gps: 'green',
  network: 'amber',
  fused: 'slate',
};

function formatCoord(val: number, decimals = 6) {
  return val.toFixed(decimals);
}

export function DeviceLocationsPage() {
  const [page, setPage] = useState(1);
  const {data, isLoading, isFetching} = useDeviceLocations(page);

  return (
    <div>
      <PageHeader
        title="Device Locations"
        subtitle="Location records synced from student devices"
      />

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <Table
            head={
              <>
                <Th>User</Th>
                <Th>Device ID</Th>
                <Th>Latitude</Th>
                <Th>Longitude</Th>
                <Th>Accuracy (m)</Th>
                <Th>Source</Th>
                <Th>Battery</Th>
                <Th>Recorded At</Th>
              </>
            }>
            {data && data.data.length > 0 ? (
              data.data.map(loc => (
                <tr key={loc.id}>
                  <Td className="font-medium text-slate-800">
                    {loc.user_email ?? <span className="text-slate-400">—</span>}
                  </Td>
                  <Td className="max-w-[120px] truncate font-mono text-xs text-slate-500">
                    {loc.device_id ? (
                      <span title={loc.device_id}>{loc.device_id.slice(0, 8)}…</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td className="font-mono text-xs">{formatCoord(loc.latitude)}</Td>
                  <Td className="font-mono text-xs">{formatCoord(loc.longitude)}</Td>
                  <Td>{Math.round(loc.accuracy)}</Td>
                  <Td>
                    <Badge color={SOURCE_COLORS[loc.location_source] ?? 'slate'}>
                      {loc.location_source}
                    </Badge>
                  </Td>
                  <Td>
                    {loc.battery_level != null ? (
                      <span
                        className={
                          loc.battery_level < 20
                            ? 'font-medium text-red-600'
                            : 'text-slate-700'
                        }>
                        {loc.battery_level}%
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td>{new Date(loc.recorded_at).toLocaleString()}</Td>
                </tr>
              ))
            ) : (
              <EmptyRow colSpan={8} message="No location records found." />
            )}
          </Table>

          {data && data.last_page > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span>
                Page {data.current_page} of {data.last_page} · {data.total} records
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
