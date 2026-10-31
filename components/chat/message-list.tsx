'use client'

import { useEffect, useRef } from 'react'
import type { ChatMessage, ChatStatus } from '@/lib/chat-types'
import { cn } from '@/lib/utils'
import { formatMs, formatNumber, formatRate, getLatency, getMessageText, modelLabel } from '@/lib/format'

const SUGGESTIONS = [
  'Explain how HTTP streaming works in two paragraphs.',
  'Write a haiku about latency.',
  'Compare REST and GraphQL in a short table.',
]

type MessageListProps = {
  messages: ChatMessage[]
  status: ChatStatus
  canSend: boolean
  selectedId: string | null
  onInspect: (id: string) => void
  onSuggestion: (text: string) => void
}

export function MessageList({ messages, status, canSend, selectedId, onInspect, onSuggestion }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
        <div className="flex max-w-md flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-balance">Start a conversation</h2>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Every reply is captured with its raw API payload, token usage, and timings. Open any
            response in the inspector to see what came back.
          </p>
        </div>
        <ul className="flex w-full max-w-md flex-col gap-2">
          {SUGGESTIONS.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => onSuggestion(s)}
                disabled={!canSend}
                className="w-full rounded-md border border-border bg-card px-4 py-3 text-left text-sm hover:border-primary/50"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const lastId = messages.at(-1)?.id

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
      <ol className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6">
        {messages.map((message) =>
          message.role === 'user' ? (
            <li key={message.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-secondary px-4 py-3 text-sm leading-relaxed text-secondary-foreground">
                {getMessageText(message)}
              </p>
            </li>
          ) : (
            <AssistantMessage
              key={message.id}
              message={message}
              isWaiting={status === 'submitted' && message.id === lastId}
              isStreaming={status === 'streaming' && message.id === lastId}
              isFailed={status === 'error' && message.id === lastId}
              isSelected={message.id === selectedId}
              onInspect={() => onInspect(message.id)}
            />
          ),
        )}
      </ol>
      <div ref={endRef} />
    </div>
  )
}

function AssistantMessage({
  message,
  isWaiting,
  isStreaming,
  isFailed,
  isSelected,
  onInspect,
}: {
  message: ChatMessage
  isWaiting: boolean
  isStreaming: boolean
  isFailed: boolean
  isSelected: boolean
  onInspect: () => void
}) {
  const meta = message.metadata
  const done = meta?.completedAt != null

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-lg border px-4 py-4 transition-colors',
        isSelected ? 'border-primary/40 bg-card' : 'border-transparent',
      )}
    >
      <div className="font-mono text-xs text-muted-foreground">{modelLabel(meta?.model)}</div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {getMessageText(message)}
        {isStreaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-text-bottom" aria-hidden="true" />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="flex min-h-4 flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
          {done ? (
            <>
              {formatMs(getLatency(message))} · {formatNumber(meta?.usage?.totalTokens)} tok ·{' '}
              {formatRate(meta?.performance?.outputTokensPerSecond)}
            </>
          ) : isStreaming ? (
            'streaming…'
          ) : isFailed ? (
            <span className="text-destructive">request failed</span>
          ) : isWaiting ? (
            <>
              <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
              thinking...
            </>
          ) : (
            'stopped'
          )}
        </p>
        <button
          type="button"
          onClick={onInspect}
          aria-pressed={isSelected}
          className="font-mono text-xs text-primary hover:underline"
        >
          inspect →
        </button>
      </div>
    </li>
  )
}
