/**
 * DEV-ONLY API key seed (LOCAL — git-ignored, never commit real keys).
 *
 * Fill in your own Gemini / ChatGPT key below so it is seeded into the device
 * Keychain automatically on launch (only in __DEV__ builds). Leave a value
 * empty to skip seeding that provider.
 *
 * See devKeys.example.ts for the template.
 */
import type {DevKeys} from './devKeys.types';

export const devKeys: DevKeys = {
  gemini: 'AQ.Ab8RN6JHhSX9zpDAfcJ1gTcezPKYQf8qlOUnevEvICuaNdNEfg',
  chatgpt: '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',
};
