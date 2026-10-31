import type { ChatMessage } from './chat-types'

export function formatMs(ms: number | undefined) {
  if (ms == null || !Number.isFinite(ms)) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`
}

export function formatNumber(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US')
}

export function formatRate(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(1)} tok/s`
}

export function formatCost(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `$${value < 0.01 ? value.toFixed(5) : value.toFixed(3)}`
}

export function getLatency(message: ChatMessage) {
  const { createdAt, completedAt } = message.metadata ?? {}
  return createdAt != null && completedAt != null ? completedAt - createdAt : undefined
}

export function getMessageText(message: ChatMessage) {
  return message.parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')
}

export function modelLabel(id: string | undefined) {
  if (!id) return 'model'
  return id.split('/').at(-1) ?? id
}
