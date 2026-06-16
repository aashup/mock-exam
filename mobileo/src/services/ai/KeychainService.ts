import * as Keychain from 'react-native-keychain';
import type {AIProvider} from '@/types/models';
import {devKeys} from '@/config/devKeys';

/**
 * Stores AI provider API keys in the device's secure keystore (Keychain /
 * Android Keystore). Keys are NEVER written to AsyncStorage, Zustand, or
 * synced to the backend — they remain device-only.
 */
const serviceName = (provider: AIProvider) => `ai_key_${provider}`;

export const KeychainService = {
  async saveKey(provider: AIProvider, key: string): Promise<void> {
    await Keychain.setGenericPassword(provider, key, {service: serviceName(provider)});
  },

  async getKey(provider: AIProvider): Promise<string | null> {
    const creds = await Keychain.getGenericPassword({service: serviceName(provider)});
    return creds ? creds.password : null;
  },

  async deleteKey(provider: AIProvider): Promise<void> {
    await Keychain.resetGenericPassword({service: serviceName(provider)});
  },

  async hasKey(provider: AIProvider): Promise<boolean> {
    return (await KeychainService.getKey(provider)) != null;
  },

  /**
   * Dev convenience: seeds API keys from the git-ignored `src/config/devKeys.ts`
   * into the Keychain on launch so you don't have to re-enter them after a
   * reinstall. No-op in release builds, and never overwrites a key already
   * present on the device. Real keys still live ONLY in the Keychain — they are
   * never synced or persisted elsewhere.
   */
  async seedDevKeys(): Promise<void> {
    if (!__DEV__) {
      return;
    }
    const providers: AIProvider[] = ['gemini', 'chatgpt'];
    for (const provider of providers) {
      const key = devKeys[provider]?.trim();
      if (!key) {
        continue;
      }
      if (await KeychainService.hasKey(provider)) {
        continue;
      }
      await KeychainService.saveKey(provider, key);
    }
  },
};
