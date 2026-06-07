import {api} from './client';
import type {ActivityLog, ApiUsageRow, DeviceLocation, Paginated, User} from '@/types/models';

export async function listUsers(page = 1): Promise<Paginated<User>> {
  const {data} = await api.get<{users: Paginated<User>}>('/admin/users', {params: {page}});
  return data.users;
}

export async function listApiUsage(): Promise<ApiUsageRow[]> {
  const {data} = await api.get<{usage: ApiUsageRow[]}>('/admin/api-usage');
  return data.usage;
}

export async function listActivityLogs(page = 1): Promise<Paginated<ActivityLog>> {
  const {data} = await api.get<{logs: Paginated<ActivityLog>}>('/admin/activity-logs', {
    params: {page},
  });
  return data.logs;
}

export async function listDeviceLocations(page = 1): Promise<Paginated<DeviceLocation>> {
  const {data} = await api.get<{locations: Paginated<DeviceLocation>}>('/admin/device-locations', {
    params: {page},
  });
  return data.locations;
}
