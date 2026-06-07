import {create} from 'zustand';
import * as Keychain from 'react-native-keychain';

const AUTH_SERVICE = 'auth_token';

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

/** Authentication state. The Sanctum token is persisted in the Keychain. */
export const useAuthStore = create<AuthState>(set => ({
  user: null,
  token: null,
  isHydrated: false,

  async setSession(user, token) {
    await Keychain.setGenericPassword(user.email, token, {service: AUTH_SERVICE});
    set({user, token});
  },

  async hydrate() {
    const creds = await Keychain.getGenericPassword({service: AUTH_SERVICE});
    set({token: creds ? creds.password : null, isHydrated: true});
  },

  async logout() {
    await Keychain.resetGenericPassword({service: AUTH_SERVICE});
    set({user: null, token: null});
  },
}));

export type {User};
export {AUTH_SERVICE};
