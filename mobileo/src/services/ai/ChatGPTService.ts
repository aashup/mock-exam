import axios from 'axios';
import type {AIQuestionGenerator, AIResponse, GenerationParams} from '@/types/ai';
import {buildPrompt} from './promptBuilder';
import {parseAIResponse} from './responseParser';

const URL = 'https://api.openai.com/v1/chat/completions';

/** OpenAI ChatGPT adapter (chat completions API, JSON mode). */
export const ChatGPTService: AIQuestionGenerator = {
  provider: 'chatgpt',

  async generate(
    params: GenerationParams,
    apiKey: string,
    model = 'gpt-4o-mini',
  ): Promise<AIResponse> {
    const prompt = buildPrompt(params);

    const {data} = await axios.post(
      URL,
      {
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are an exam question generator. Always respond with a JSON array of question objects only.',
          },
          {role: 'user', content: prompt},
        ],
        temperature: 0.7,
        response_format: {type: 'json_object'},
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000,
      },
    );

    const text: string = data?.choices?.[0]?.message?.content ?? '';
    if (!text) {
      throw new Error('ChatGPT returned an empty response.');
    }
    // JSON mode may wrap the array in an object like { "questions": [...] }.
    try {
      const obj = JSON.parse(text);
      if (Array.isArray(obj)) {
        return parseAIResponse(text);
      }
      const arr = obj.questions ?? obj.data ?? obj.items;
      return parseAIResponse(JSON.stringify(arr ?? obj));
    } catch {
      return parseAIResponse(text);
    }
  },
};
