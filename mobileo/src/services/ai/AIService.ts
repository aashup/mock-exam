import type {AIResponse, GenerationParams} from '@/types/ai';
import type {AIProvider, Difficulty, TestLanguage} from '@/types/models';
import {questionRepo} from '@/db/repositories/questionRepo';
import {isOnline} from '@/hooks/useNetworkStatus';
import {useSettingsStore} from '@/store/settingsStore';
import {ChatGPTService} from './ChatGPTService';
import {GeminiService} from './GeminiService';
import {KeychainService} from './KeychainService';

export class MissingApiKeyError extends Error {
  constructor(public provider: AIProvider) {
    super(`No API key configured for ${provider}.`);
    this.name = 'MissingApiKeyError';
  }
}

/** Thrown when generation is attempted without connectivity. */
export class OfflineError extends Error {
  constructor() {
    super('No internet connection. Reuse a stored set to practice offline.');
    this.name = 'OfflineError';
  }
}

function adapterFor(provider: AIProvider) {
  return provider === 'gemini' ? GeminiService : ChatGPTService;
}

/**
 * Unified entry point used by the UI. Picks the active provider/model from
 * settings, reads the key from the Keychain, generates questions, and saves
 * them to SQLite. Returns the new local question_set id.
 */
export const AIService = {
  async generateAndStore(params: {
    subjectId: number;
    subjectName: string;
    courseId: number | null;
    courseName: string | null;
    difficulty: Difficulty;
    count: number;
    language: TestLanguage;
  }): Promise<number> {
    const {activeProvider, geminiModel, chatgptModel} = useSettingsStore.getState();

    // Generation requires a live AI API call — bail early when offline so the
    // UI can fall back to reusing a stored set.
    if (!(await isOnline())) {
      throw new OfflineError();
    }

    const apiKey = await KeychainService.getKey(activeProvider);
    if (!apiKey) {
      throw new MissingApiKeyError(activeProvider);
    }

    const genParams: GenerationParams = {
      subject: params.subjectName,
      course: params.courseName,
      difficulty: params.difficulty,
      count: params.count,
      language: params.language,
    };

    const model = activeProvider === 'gemini' ? geminiModel : chatgptModel;
    const response: AIResponse = await adapterFor(activeProvider).generate(
      genParams,
      apiKey,
      model,
    );

    return questionRepo.saveGeneratedSet({
      subjectId: params.subjectId,
      courseId: params.courseId,
      difficulty: params.difficulty,
      language: params.language,
      questions: response,
    });
  },

  /** Sends a single-question test prompt to verify a key works. */
  async testConnection(provider: AIProvider): Promise<boolean> {
    const apiKey = await KeychainService.getKey(provider);
    if (!apiKey) {
      throw new MissingApiKeyError(provider);
    }
    const {geminiModel, chatgptModel} = useSettingsStore.getState();
    const model = provider === 'gemini' ? geminiModel : chatgptModel;
    const res = await adapterFor(provider).generate(
      {subject: 'General Knowledge', difficulty: 'Easy', count: 1},
      apiKey,
      model,
    );
    return res.length > 0;
  },
};
