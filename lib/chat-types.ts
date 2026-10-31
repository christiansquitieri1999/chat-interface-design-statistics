export const MODELS = [
  { id: 'openai/gpt-oss-120b', label: 'GPT OSS 120B' },
  { id: 'openai/gpt-oss-20b', label: 'GPT OSS 20B' },
  { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B' },
] as const

export type ModelId = (typeof MODELS)[number]['id']

export const DEFAULT_MODEL: ModelId = 'openai/gpt-oss-120b'

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

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  parts: { type: 'text'; text: string }[]
  metadata?: ChatMetadata
}

export type ChatStatus = 'ready' | 'submitted' | 'streaming' | 'error'
