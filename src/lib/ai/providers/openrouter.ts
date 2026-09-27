import type { ProviderResult } from '../types'
import { generateOpenAiCompatible, type ProviderArgs } from './shared'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * Call OpenRouter's Chat Completions endpoint with the caller's own key.
 * OpenRouter proxies many underlying models (OpenAI, Anthropic, Gemini,
 * DeepSeek, ...) behind one OpenAI-compatible API, so `model` is a
 * free-text OpenRouter model slug (e.g. "openai/gpt-5.4-mini"). The
 * `X-Title` header is OpenRouter's optional app-attribution header for
 * its dashboard/leaderboard — harmless to send, not required.
 */
export async function generateOpenRouter(args: ProviderArgs): Promise<ProviderResult> {
  return generateOpenAiCompatible({
    url: OPENROUTER_URL,
    providerLabel: 'OpenRouter',
    extraHeaders: { 'X-Title': 'WAGenie' },
    ...args,
  })
}
