'use client'

import { PanelRight, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_MODEL, MODELS, type ChatMessage, type ChatStatus, type ModelId } from '@/lib/chat-types'
import { getMessageText } from '@/lib/format'
import { Composer } from './composer'
import { Inspector } from './inspector'
import { MessageList } from './message-list'

type GroqStreamChunk = {
  id?: string
  model?: string
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    prompt_tokens_details?: { cached_tokens?: number }
    completion_tokens_details?: { reasoning_tokens?: number }
    cost?: number
  }
  error?: { message?: string }
}

const STORAGE_KEY = 'tracer-chat-history'

function isStoredMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false

  const message = value as Partial<ChatMessage>
  return (
    typeof message.id === 'string' &&
    (message.role === 'user' || message.role === 'assistant') &&
    Array.isArray(message.parts) &&
    message.parts.every(
      (part) =>
        typeof part === 'object' &&
        part !== null &&
        part.type === 'text' &&
        typeof part.text === 'string',
    ) &&
    (message.metadata === undefined ||
      (typeof message.metadata === 'object' && message.metadata !== null && !Array.isArray(message.metadata)))
  )
}

export function ChatApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isHydrated, setIsHydrated] = useState(false)
  const [status, setStatus] = useState<ChatStatus>('ready')
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed: unknown = JSON.parse(stored)
        if (Array.isArray(parsed)) setMessages(parsed.filter(isStoredMessage))
      }
    } catch {
      setMessages([])
    } finally {
      setIsHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!isHydrated) return

    try {
      if (messages.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY)
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
      }
    } catch {
      return
    }
  }, [isHydrated, messages])

  const assistantMessages = messages.filter((m) => m.role === 'assistant')
  const selected =
    assistantMessages.find((m) => m.id === selectedId) ?? assistantMessages.at(-1) ?? null
  const isBusy = status === 'submitted' || status === 'streaming'

  function handleSend(text: string) {
    if (!isHydrated) return
    void sendMessage(text)
  }

  async function sendMessage(text: string) {
    setSelectedId(null)
    setError(null)
    const startedAt = Date.now()
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text }],
    }
    const assistantId = crypto.randomUUID()
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      parts: [{ type: 'text', text: '' }],
      metadata: { createdAt: startedAt, model },
    }
    const requestMessages = [...messages, userMessage]
    setMessages((current) => [...current, userMessage, assistantMessage])
    setStatus('submitted')

    const controller = new AbortController()
    abortRef.current = controller
    let firstOutputAt: number | undefined
    let assistantText = ''
    let responseId: string | undefined
    let responseModelId: string | undefined
    let finishReason: string | undefined
    let usage: GroqStreamChunk['usage']
    let streamFinished = false

    function updateAssistant(update: (message: ChatMessage) => ChatMessage) {
      setMessages((current) => current.map((message) => (message.id === assistantId ? update(message) : message)))
    }

    function consumeBlock(block: string) {
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
      if (!data) return
      if (data === '[DONE]') {
        streamFinished = true
        return
      }

      const chunk = JSON.parse(data) as GroqStreamChunk
      if (chunk.error?.message) throw new Error(chunk.error.message)
      responseId = chunk.id ?? responseId
      responseModelId = chunk.model ?? responseModelId
      usage = chunk.usage ?? usage
      finishReason = chunk.choices?.[0]?.finish_reason ?? finishReason

      const content = chunk.choices?.[0]?.delta?.content
      if (content) {
        firstOutputAt ??= Date.now()
        assistantText += content
        setStatus('streaming')
        updateAssistant((message) => ({
          ...message,
          parts: [{ type: 'text', text: assistantText }],
        }))
      }
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: requestMessages.map((message) => ({
            role: message.role,
            content: getMessageText(message),
          })),
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error ?? `Request failed with status ${response.status}.`)
      }
      if (!response.body) throw new Error('The API returned an empty response stream.')

      const responseHeaders: Record<string, string> = {}
      const requestId = response.headers.get('x-request-id')
      if (requestId) responseHeaders['x-request-id'] = requestId

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split(/\r?\n\r?\n/)
        buffer = blocks.pop() ?? ''
        for (const block of blocks) consumeBlock(block)
      }
      buffer += decoder.decode()
      if (buffer.trim()) consumeBlock(buffer)
      if (!streamFinished) throw new Error('The response stream ended unexpectedly.')

      const completedAt = Date.now()
      const inputTokens = usage?.prompt_tokens
      const outputTokens = usage?.completion_tokens
      const generationMs = completedAt - (firstOutputAt ?? startedAt)
      updateAssistant((message) => ({
        ...message,
        metadata: {
          ...message.metadata,
          completedAt,
          responseId,
          responseModelId,
          responseHeaders,
          finishReason,
          steps: 1,
          ...(usage?.cost != null ? { cost: usage.cost } : {}),
          usage: {
            inputTokens,
            outputTokens,
            totalTokens: usage?.total_tokens,
            reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens,
            cachedInputTokens: usage?.prompt_tokens_details?.cached_tokens,
          },
          performance: {
            timeToFirstOutputMs: firstOutputAt == null ? undefined : firstOutputAt - startedAt,
            outputTokensPerSecond:
              outputTokens != null && generationMs > 0 ? (outputTokens * 1000) / generationMs : undefined,
            responseTimeMs: completedAt - startedAt,
          },
        },
      }))
      setStatus('ready')
    } catch (requestError) {
      if (controller.signal.aborted || abortRef.current !== controller) return
      setError(requestError instanceof Error ? requestError.message : 'The request failed.')
      setStatus('error')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  function handleInspect(id: string) {
    setSelectedId(id)
    setInspectorOpen(true)
  }

  function handleReset() {
    abortRef.current?.abort()
    abortRef.current = null
    let storageError: string | null = null
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      storageError = 'Unable to clear the saved conversation from this browser.'
    }
    setMessages([])
    setSelectedId(null)
    setError(storageError)
    setStatus('ready')
  }

  function handleStop() {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('ready')
  }

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <span className="size-2.5 rounded-full bg-primary" aria-hidden="true" />
          <h1 className="font-mono text-sm font-medium tracking-tight">tracer</h1>
          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
            chat / response inspector
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="model" className="sr-only">
            Model
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value as ModelId)}
            disabled={isBusy}
            className="h-9 rounded-md border border-border bg-card px-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleReset}
            disabled={messages.length === 0}
            title="Clear conversation"
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            <span className="sr-only">Clear conversation</span>
          </button>
          <button
            type="button"
            onClick={() => setInspectorOpen((o) => !o)}
            aria-expanded={inspectorOpen}
            aria-controls="inspector"
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground lg:hidden"
          >
            <PanelRight className="size-4" aria-hidden="true" />
            <span className="sr-only">Toggle inspector</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <MessageList
            messages={messages}
            status={status}
            canSend={isHydrated}
            selectedId={selected?.id ?? null}
            onInspect={handleInspect}
            onSuggestion={handleSend}
          />
          {error && (
            <p role="alert" className="mx-auto w-full max-w-3xl px-4 pb-2 font-mono text-xs text-destructive md:px-6">
              {error}
            </p>
          )}
          <Composer onSend={handleSend} onStop={handleStop} isBusy={isBusy} canSend={isHydrated} />
        </main>

        <Inspector
          id="inspector"
          open={inspectorOpen}
          onClose={() => setInspectorOpen(false)}
          selected={selected}
          responses={assistantMessages}
          onSelect={setSelectedId}
        />
      </div>
    </div>
  )
}
