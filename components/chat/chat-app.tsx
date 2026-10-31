'use client'

import { useChat } from '@ai-sdk/react'
import { PanelRight, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { DEFAULT_MODEL, MODELS, type ChatMessage, type ModelId } from '@/lib/chat-types'
import { Composer } from './composer'
import { Inspector } from './inspector'
import { MessageList } from './message-list'

export function ChatApp() {
  const { messages, sendMessage, status, stop, error, setMessages } = useChat<ChatMessage>()
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)

  const assistantMessages = messages.filter((m) => m.role === 'assistant')
  const selected =
    assistantMessages.find((m) => m.id === selectedId) ?? assistantMessages.at(-1) ?? null
  const isBusy = status === 'submitted' || status === 'streaming'

  function handleSend(text: string) {
    setSelectedId(null)
    sendMessage({ text }, { body: { model } })
  }

  function handleInspect(id: string) {
    setSelectedId(id)
    setInspectorOpen(true)
  }

  function handleReset() {
    stop()
    setMessages([])
    setSelectedId(null)
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
                {m.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleReset}
            disabled={messages.length === 0}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            <span className="sr-only">New conversation</span>
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
            selectedId={selected?.id ?? null}
            onInspect={handleInspect}
            onSuggestion={handleSend}
          />
          {error && (
            <p role="alert" className="mx-auto w-full max-w-3xl px-4 pb-2 font-mono text-xs text-destructive md:px-6">
              {error.message}
            </p>
          )}
          <Composer onSend={handleSend} onStop={stop} isBusy={isBusy} />
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
