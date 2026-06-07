import axios from 'axios';

const TOKEN_KEY = 'admin_token';
const USER_KEY = 'admin_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/** Wipes all persisted auth state (token + cached user). */
export function clearAuthStorage(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Single axios instance. Base URL comes from env (defaults to the Vite proxy path). */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: {Accept: 'application/json'},
});

// Attach the Bearer token to every request.
api.interceptors.request.use(config => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, drop the token and bounce to login (unless we're already there).
api.interceptors.response.use(
  res => res,
  error => {
    if (error?.response?.status === 401) {
      clearAuthStorage();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

/** Extracts a human-readable message from an axios error (validation or generic). */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {message?: string; errors?: Record<string, string[]>}
      | undefined;
    if (data?.errors) {
      const first = Object.values(data.errors)[0]?.[0];
      if (first) {
        return first;
      }
    }
    return data?.message ?? error.message ?? fallback;
  }
  return fallback;
}
