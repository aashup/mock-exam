import * as SecureStore from 'expo-secure-store';
import type {AIProvider} from '@/types/models';
import {devKeys} from '@/config/devKeys';

/**
 * Stores AI provider API keys in the device's secure keystore (Keychain /
 * Android Keystore via expo-secure-store). Keys are NEVER written to
 * AsyncStorage, Zustand, or synced to the backend — they remain device-only.
 */
const storeKey = (provider: AIProvider) => `ai_key_${provider}`;

export const KeychainService = {
  async saveKey(provider: AIProvider, key: string): Promise<void> {
    await SecureStore.setItemAsync(storeKey(provider), key);
  },

  async getKey(provider: AIProvider): Promise<string | null> {
    return SecureStore.getItemAsync(storeKey(provider));
  },

  async deleteKey(provider: AIProvider): Promise<void> {
    await SecureStore.deleteItemAsync(storeKey(provider));
  },

  async hasKey(provider: AIProvider): Promise<boolean> {
    return (await KeychainService.getKey(provider)) != null;
  },

  /**
   * Dev convenience: seeds API keys from the git-ignored `src/config/devKeys.ts`
   * into secure storage on launch so you don't have to re-enter them after a
   * reinstall. No-op in release builds, and never overwrites a key already present.
   */
  async seedDevKeys(): Promise<void> {
    if (!__DEV__) return;
    const providers: AIProvider[] = ['gemini', 'chatgpt'];
    for (const provider of providers) {
      const key = devKeys[provider]?.trim();
      if (!key) continue;
      if (await KeychainService.hasKey(provider)) continue;
      await KeychainService.saveKey(provider, key);
    }
  },
};
