'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import type { ChatMessage } from '@/lib/chat-types'
import { formatCost, formatMs, formatNumber, formatRate, getLatency } from '@/lib/format'

type ResponsePanelProps = {
  message: ChatMessage | null
  responses: ChatMessage[]
  onSelect: (id: string) => void
}

export function ResponsePanel({ message, responses, onSelect }: ResponsePanelProps) {
  if (!message) {
    return (
      <p className="px-4 py-8 text-sm leading-relaxed text-muted-foreground">
        Send a message to capture its API response here.
      </p>
    )
  }

  const meta = message.metadata ?? {}
  const usage = meta.usage ?? {}
  const index = responses.findIndex((r) => r.id === message.id)

  const rows: [string, string][] = [
    ['requested model', meta.model ?? '—'],
    ['resolved model', meta.responseModelId ?? '—'],
    ['finish reason', meta.finishReason ?? (meta.completedAt ? '—' : 'streaming')],
    ['steps', formatNumber(meta.steps)],
    ['total latency', formatMs(getLatency(message))],
    ['time to first token', formatMs(meta.performance?.timeToFirstOutputMs)],
    ['throughput', formatRate(meta.performance?.outputTokensPerSecond)],
    ['input tokens', formatNumber(usage.inputTokens)],
    ['cached input', formatNumber(usage.cachedInputTokens)],
    ['output tokens', formatNumber(usage.outputTokens)],
    ['reasoning tokens', formatNumber(usage.reasoningTokens)],
    ['total tokens', formatNumber(usage.totalTokens)],
    ['cost', formatCost(meta.cost)],
  ]

  const payload = JSON.stringify(
    { id: message.id, role: message.role, metadata: message.metadata, parts: message.parts },
    null,
    2,
  )

  return (
    <div className="flex flex-col gap-6 px-4 py-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-xs text-muted-foreground">
            response {index + 1} of {responses.length}
          </span>
          <span className="truncate font-mono text-xs" title={meta.responseId}>
            {meta.responseId ?? message.id}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={index <= 0}
            onClick={() => onSelect(responses[index - 1].id)}
            className="h-8 rounded-md border border-sidebar-border px-2 font-mono text-xs disabled:opacity-40"
          >
            ← prev
          </button>
          <button
            type="button"
            disabled={index >= responses.length - 1}
            onClick={() => onSelect(responses[index + 1].id)}
            className="h-8 rounded-md border border-sidebar-border px-2 font-mono text-xs disabled:opacity-40"
          >
            next →
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 border-t border-sidebar-border">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="border-b border-sidebar-border py-2 text-xs text-muted-foreground">{label}</dt>
            <dd className="truncate border-b border-sidebar-border py-2 text-right font-mono text-xs" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-2" aria-labelledby="raw-heading">
        <div className="flex items-center justify-between">
          <h3 id="raw-heading" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            raw payload
          </h3>
          <CopyButton value={payload} />
        </div>
        <pre className="max-h-[28rem] overflow-auto rounded-md bg-code p-3 font-mono text-xs leading-relaxed text-code-foreground">
          {payload}
        </pre>
      </section>
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {copied ? 'copied' : 'copy json'}
    </button>
  )
}
