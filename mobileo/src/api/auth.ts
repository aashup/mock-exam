import {api} from './client';
import type {User} from '@/store/authStore';

interface AuthResponse {
  user: User;
  token: string;
}

export const authApi = {
  async login(email: string, password: string, deviceId: string): Promise<AuthResponse> {
    const {data} = await api.post('/auth/login', {email, password, device_id: deviceId});
    return data;
  },

  async register(params: {
    name: string;
    email: string;
    mobile: string;
    password: string;
    deviceId: string;
  }): Promise<AuthResponse> {
    const {data} = await api.post('/auth/register', {
      name: params.name,
      email: params.email,
      mobile: params.mobile,
      password: params.password,
      device_id: params.deviceId,
    });
    return data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async forgotPassword(email: string): Promise<void> {
    await api.post('/auth/forgot-password', {email});
  },
};
