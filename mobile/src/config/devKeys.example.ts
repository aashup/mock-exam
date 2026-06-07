/**
 * DEV-ONLY API key seed (template).
 *
 * Copy this file to `devKeys.ts` (same folder) and fill in your own keys so you
 * don't have to re-enter them on the AI Configuration screen after a reinstall.
 *
 *   cp src/config/devKeys.example.ts src/config/devKeys.ts
 *
 * `devKeys.ts` is git-ignored — NEVER commit a real key. The values here are
 * only seeded into the device Keychain in __DEV__ builds (see seedDevKeys()).
 * Leave a value empty/undefined to skip seeding that provider.
 */
import type {DevKeys} from './devKeys.types';

export const devKeys: DevKeys = {
  gemini: '',
  chatgpt: '',
};
