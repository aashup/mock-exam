import {create} from 'zustand';
import {getMeta, setMeta} from '@/db/database';
import type {AIProvider, Difficulty, FeedbackMode, TestMode} from '@/types/models';

type GeminiModel = 'gemini-2.0-flash' | 'gemini-1.5-pro';
type ChatGPTModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-3.5-turbo';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_META_KEY = 'theme_mode';
const LOCATION_TRACKING_KEY = 'location_tracking_enabled';
const LOCATION_ACCURACY_KEY = 'location_accuracy';
const LOCATION_INTERVAL_KEY = 'location_tracking_interval';

interface SettingsState {
  activeProvider: AIProvider;
  geminiModel: GeminiModel;
  chatgptModel: ChatGPTModel;

  // Test defaults
  questionsPerSession: number;
  defaultDifficulty: Difficulty;
  feedbackMode: FeedbackMode;
  testMode: TestMode;
  defaultTimerMinutes: number;

  // Sync
  autoSync: boolean;
  syncIntervalMinutes: number;

  // Appearance
  themeMode: ThemeMode;

  // Location tracking
  locationTrackingEnabled: boolean;
  locationTrackingInterval: number;
  locationAccuracy: 'high' | 'balanced' | 'low';

  setProvider: (p: AIProvider) => void;
  update: (patch: Partial<SettingsState>) => void;
  setThemeMode: (mode: ThemeMode) => void;
  hydrateTheme: () => Promise<void>;
  setLocationTracking: (enabled: boolean) => Promise<void>;
  setLocationAccuracy: (accuracy: 'high' | 'balanced' | 'low') => Promise<void>;
  hydrateLocationSettings: () => Promise<void>;
}

/**
 * App settings. NOTE: API keys are intentionally NOT stored here — they live
 * only in the secure Keychain (see KeychainService).
 */
export const useSettingsStore = create<SettingsState>(set => ({
  activeProvider: 'gemini',
  geminiModel: 'gemini-2.0-flash',
  chatgptModel: 'gpt-4o-mini',

  questionsPerSession: 10,
  defaultDifficulty: 'Medium',
  feedbackMode: 'end',
  testMode: 'untimed',
  defaultTimerMinutes: 20,

  autoSync: true,
  syncIntervalMinutes: 30,

  themeMode: 'system',

  locationTrackingEnabled: false,
  locationTrackingInterval: 1,
  locationAccuracy: 'balanced',

  setProvider: p => set({activeProvider: p}),
  update: patch => set(patch),

  setThemeMode: mode => {
    set({themeMode: mode});
    void setMeta('theme_mode', mode);
  },

  async hydrateTheme() {
    const stored = await getMeta(THEME_META_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      set({themeMode: stored});
    }
  },

  async setLocationTracking(enabled: boolean) {
    set({locationTrackingEnabled: enabled});
    await setMeta(LOCATION_TRACKING_KEY, enabled ? 'true' : 'false');
  },

  async setLocationAccuracy(accuracy: 'high' | 'balanced' | 'low') {
    set({locationAccuracy: accuracy});
    await setMeta(LOCATION_ACCURACY_KEY, accuracy);
  },

  async hydrateLocationSettings() {
    const trackingEnabled = await getMeta(LOCATION_TRACKING_KEY);
    const accuracy = await getMeta(LOCATION_ACCURACY_KEY);
    const interval = await getMeta(LOCATION_INTERVAL_KEY);

    if (trackingEnabled === 'true' || trackingEnabled === 'false') {
      set({locationTrackingEnabled: trackingEnabled === 'true'});
    }
    if (accuracy === 'high' || accuracy === 'balanced' || accuracy === 'low') {
      set({locationAccuracy: accuracy});
    }
    if (interval) {
      const parsed = parseInt(interval, 10);
      if (!isNaN(parsed) && parsed > 0) {
        set({locationTrackingInterval: parsed});
      }
    }
  },
}));
