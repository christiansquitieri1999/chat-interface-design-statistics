import type { UIMessage } from 'ai'

export const MODELS = [
  { id: 'openai/gpt-5.5', label: 'GPT-5.5' },
  { id: 'openai/gpt-5.4-mini', label: 'GPT-5.4 mini' },
  { id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5' },
  { id: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5' },
  { id: 'google/gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
] as const

export type ModelId = (typeof MODELS)[number]['id']

export const DEFAULT_MODEL: ModelId = 'openai/gpt-5.4-mini'

export function isModelId(value: unknown): value is ModelId {
  return MODELS.some((m) => m.id === value)
}

export type ChatUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  reasoningTokens?: number
  cachedInputTokens?: number
}

export type ChatPerformance = {
  timeToFirstOutputMs?: number
  outputTokensPerSecond?: number
  responseTimeMs?: number
}

export type ChatMetadata = {
  createdAt?: number
  completedAt?: number
  model?: string
  responseId?: string
  responseModelId?: string
  finishReason?: string
  steps?: number
  usage?: ChatUsage
  performance?: ChatPerformance
  cost?: number
  responseHeaders?: Record<string, string>
  providerMetadata?: unknown
}

export type ChatMessage = UIMessage<ChatMetadata>
