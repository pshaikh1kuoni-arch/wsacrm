import type { ProviderResult } from '../types'
import { generateOpenAiCompatible, type ProviderArgs } from './shared'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

/**
 * Call DeepSeek's Chat Completions endpoint with the caller's own key.
 * DeepSeek's API is OpenAI-compatible, so this is a thin wrapper around
 * the shared adapter.
 */
export async function generateDeepSeek(args: ProviderArgs): Promise<ProviderResult> {
  return generateOpenAiCompatible({
    url: DEEPSEEK_URL,
    providerLabel: 'DeepSeek',
    ...args,
  })
}
