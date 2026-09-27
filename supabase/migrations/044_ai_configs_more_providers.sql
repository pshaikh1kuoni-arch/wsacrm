-- ============================================================
-- 044_ai_configs_more_providers.sql — DeepSeek + OpenRouter as AI
-- reply assistant providers
--
-- Widens the provider CHECK constraints added in 029_ai_reply.sql
-- (ai_configs) and 033_ai_reply_polish.sql (ai_usage_log) from
-- ('openai', 'anthropic') to also allow 'deepseek' and 'openrouter'.
-- Both adapters speak DeepSeek's / OpenRouter's OpenAI-compatible Chat
-- Completions API with the account's own BYO key — same shape as the
-- existing openai/anthropic providers, no new columns needed.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE ai_configs DROP CONSTRAINT IF EXISTS ai_configs_provider_check;
ALTER TABLE ai_configs ADD CONSTRAINT ai_configs_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'deepseek', 'openrouter'));

ALTER TABLE ai_usage_log DROP CONSTRAINT IF EXISTS ai_usage_log_provider_check;
ALTER TABLE ai_usage_log ADD CONSTRAINT ai_usage_log_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'deepseek', 'openrouter'));
