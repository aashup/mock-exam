import {create} from 'zustand';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';

interface User {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  role: 'student' | 'admin';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isHydrated: boolean;

  setSession: (user: User, token: string) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

/** Authentication state. The Sanctum token is persisted via expo-secure-store. */
export const useAuthStore = create<AuthState>(set => ({
  user: null,
  token: null,
  isHydrated: false,

  async setSession(user, token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({user, token});
  },

  async hydrate() {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    set({token: token ?? null, isHydrated: true});
  },

  async logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({user: null, token: null});
  },
}));

export type {User};
export {TOKEN_KEY};
