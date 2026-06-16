import axios, {type AxiosInstance} from 'axios';
import {useAuthStore} from '@/store/authStore';

/**
 * Laravel backend base URL.
 *
 * Physical device (USB): `adb reverse tcp:8000 tcp:8000` forwards the device's
 *   localhost:8000 to the host, so `http://localhost:8000` works.
 * Android emulator: use `http://10.0.2.2:8000` (the emulator's host alias).
 */
export const API_BASE_URL = 'http://localhost:8000/api';

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {Accept: 'application/json'},
});

// Attach the Sanctum bearer token to every request.
api.interceptors.request.use(config => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const url = `${config.baseURL ?? ''}${config.url ?? ''}`;
  console.log(
    `[API →] ${config.method?.toUpperCase()} ${url}`,
    config.data ? JSON.stringify(config.data).slice(0, 300) : '',
  );
  return config;
});

// On 401, clear the session so the app routes back to login.
api.interceptors.response.use(
  res => {
    console.log(
      `[API ←] ${res.status} ${res.config.method?.toUpperCase()} ${res.config.url}`,
      typeof res.data === 'object' ? JSON.stringify(res.data).slice(0, 500) : res.data,
    );
    return res;
  },
  async error => {
    // Log the full failure shape so network vs. HTTP errors are distinguishable.
    const cfg = error?.config ?? {};
    const reqUrl = `${cfg.baseURL ?? ''}${cfg.url ?? ''}`;
    if (error?.response) {
      // Server responded with a non-2xx status.
      console.log(
        `[API ✗] HTTP ${error.response.status} ${cfg.method?.toUpperCase()} ${reqUrl}`,
        JSON.stringify(error.response.data).slice(0, 500),
      );
    } else {
      // No response — DNS/connection/timeout. This is the "Network Error" case.
      console.log(
        `[API ✗] NO RESPONSE ${cfg.method?.toUpperCase()} ${reqUrl} — ` +
          `code=${error?.code} message=${error?.message}`,
      );
    }
    if (error?.response?.status === 401) {
      await useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
