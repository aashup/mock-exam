import axios from 'axios';
import type {AIQuestionGenerator, AIResponse, GenerationParams} from '@/types/ai';
import {aiLogger} from './aiLogger';
import {buildPrompt} from './promptBuilder';
import {parseAIResponse} from './responseParser';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Google Gemini adapter (generateContent REST API). */
export const GeminiService: AIQuestionGenerator = {
  provider: 'gemini',

  async generate(
    params: GenerationParams,
    apiKey: string,
    model = 'gemini-2.0-flash',
  ): Promise<AIResponse> {
    const prompt = buildPrompt(params);
    const url = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{parts: [{text: prompt}]}],
      generationConfig: {temperature: 0.7, responseMimeType: 'application/json'},
    };

    aiLogger.request('gemini', url, body);

    let data: any;
    try {
      const res = await axios.post(url, body, {
        headers: {'Content-Type': 'application/json'},
        timeout: 60000,
      });
      data = res.data;
      aiLogger.response('gemini', res.status, data);
    } catch (err) {
      aiLogger.error('gemini', err);
      throw err;
    }

    const text: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }
    return parseAIResponse(text);
  },
};
