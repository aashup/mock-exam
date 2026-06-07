import {useQuery} from '@tanstack/react-query';
import * as adminApi from '@/api/admin';

export function useUsers(page: number) {
  return useQuery({
    queryKey: ['users', page],
    queryFn: () => adminApi.listUsers(page),
  });
}

export function useApiUsage() {
  return useQuery({queryKey: ['api-usage'], queryFn: adminApi.listApiUsage});
}

export function useActivityLogs(page: number) {
  return useQuery({
    queryKey: ['activity-logs', page],
    queryFn: () => adminApi.listActivityLogs(page),
  });
}

export function useDeviceLocations(page: number) {
  return useQuery({
    queryKey: ['device-locations', page],
    queryFn: () => adminApi.listDeviceLocations(page),
  });
}
