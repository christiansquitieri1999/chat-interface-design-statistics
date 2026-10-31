'use client'

import { ArrowUp, Square } from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent } from 'react'

type ComposerProps = {
  onSend: (text: string) => void
  onStop: () => void
  isBusy: boolean
  canSend: boolean
}

export function Composer({ onSend, onStop, isBusy, canSend }: ComposerProps) {
  const [input, setInput] = useState('')

  function submit() {
    const text = input.trim()
    if (!text || isBusy || !canSend) return
    onSend(text)
    setInput('')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    submit()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="border-t border-border bg-background">
      <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 py-4 md:px-6">
        <label htmlFor="prompt" className="sr-only">
          Message
        </label>
        <textarea
          id="prompt"
          value={input}
          disabled={!canSend}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Send a message…"
          className="max-h-40 min-h-11 flex-1 resize-none rounded-md border border-border bg-card px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring [field-sizing:content]"
        />
        {isBusy ? (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-secondary"
          >
            <Square className="size-4" aria-hidden="true" />
            <span className="sr-only">Stop generating</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend || !input.trim()}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
            <span className="sr-only">Send</span>
          </button>
        )}
      </form>
    </div>
  )
}
