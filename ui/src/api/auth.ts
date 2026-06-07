import {api} from './client';
import type {AuthResponse, User} from '@/types/models';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const {data} = await api.post<AuthResponse>('/auth/login', {email, password});
  return data;
}

export async function me(): Promise<User> {
  const {data} = await api.get<{user: User}>('/auth/me');
  return data.user;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}
