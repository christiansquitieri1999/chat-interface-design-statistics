'use client'

import type { ChatMessage } from '@/lib/chat-types'
import { formatCost, formatMs, formatNumber, formatRate, getLatency, modelLabel } from '@/lib/format'

type StatsPanelProps = {
  responses: ChatMessage[]
  onSelect: (id: string) => void
}

function sum(values: (number | undefined)[]) {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0)
}

function average(values: (number | undefined)[]) {
  const defined = values.filter((v): v is number => v != null && Number.isFinite(v))
  return defined.length ? sum(defined) / defined.length : undefined
}

export function StatsPanel({ responses, onSelect }: StatsPanelProps) {
  const completed = responses.filter((r) => r.metadata?.completedAt != null)

  if (completed.length === 0) {
    return (
      <p className="px-4 py-8 text-sm leading-relaxed text-muted-foreground">
        Statistics appear once the first response completes.
      </p>
    )
  }

  const promptTokens = sum(completed.map((r) => r.metadata?.usage?.inputTokens))
  const completionTokens = sum(completed.map((r) => r.metadata?.usage?.outputTokens))
  const totalTokens = sum(
    completed.map((r) => {
      const usage = r.metadata?.usage
      return usage?.totalTokens ?? (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0)
    }),
  )
  const costs = completed.map((r) => r.metadata?.cost)
  const hasCost = costs.some((c) => c != null)
  const latencies = completed.map(getLatency)

  const readouts: [string, string][] = [
    ['requests', formatNumber(completed.length)],
    ['prompt tokens', formatNumber(promptTokens)],
    ['completion tokens', formatNumber(completionTokens)],
    ['total tokens', formatNumber(totalTokens)],
    ['avg latency', formatMs(average(latencies))],
    ['avg ttft', formatMs(average(completed.map((r) => r.metadata?.performance?.timeToFirstOutputMs)))],
    ['avg throughput', formatRate(average(completed.map((r) => r.metadata?.performance?.outputTokensPerSecond)))],
    ['total cost', hasCost ? formatCost(sum(costs)) : '—'],
  ]

  const maxTokens = Math.max(
    1,
    ...completed.map((r) => (r.metadata?.usage?.inputTokens ?? 0) + (r.metadata?.usage?.outputTokens ?? 0)),
  )
  const maxLatency = Math.max(1, ...latencies.map((l) => l ?? 0))

  const modelCounts = completed.reduce<Record<string, number>>((acc, r) => {
    const key = r.metadata?.model ?? 'unknown'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-8 px-4 py-5">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-sidebar-border bg-sidebar-border">
        {readouts.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 bg-sidebar p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-mono text-lg font-medium tracking-tight">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3" aria-labelledby="tokens-heading">
        <div className="flex items-center justify-between">
          <h3 id="tokens-heading" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            tokens per response
          </h3>
          <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-foreground/25" aria-hidden="true" /> prompt
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-primary" aria-hidden="true" /> completion
            </span>
          </div>
        </div>
        <ol className="flex flex-col gap-2">
          {completed.map((r, i) => {
            const inTok = r.metadata?.usage?.inputTokens ?? 0
            const outTok = r.metadata?.usage?.outputTokens ?? 0
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r.id)}
                  className="flex w-full items-center gap-3 text-left"
                  aria-label={`Response ${i + 1}: ${inTok} prompt, ${outTok} completion tokens`}
                >
                  <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">#{i + 1}</span>
                  <span className="flex h-3 flex-1 overflow-hidden rounded-sm bg-secondary">
                    <span className="h-full bg-foreground/25" style={{ width: `${(inTok / maxTokens) * 100}%` }} />
                    <span className="h-full bg-primary" style={{ width: `${(outTok / maxTokens) * 100}%` }} />
                  </span>
                  <span className="w-14 shrink-0 text-right font-mono text-xs">{formatNumber(inTok + outTok)}</span>
                </button>
              </li>
            )
          })}
        </ol>
        <p className="font-mono text-xs text-muted-foreground">
          {formatNumber(promptTokens)} prompt · {formatNumber(completionTokens)} completion
        </p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="latency-heading">
        <h3 id="latency-heading" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          latency per response
        </h3>
        <ol className="flex flex-col gap-2">
          {completed.map((r, i) => {
            const latency = getLatency(r) ?? 0
            const ttft = r.metadata?.performance?.timeToFirstOutputMs ?? 0
            return (
              <li key={r.id} className="flex items-center gap-3">
                <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">#{i + 1}</span>
                <span className="relative flex h-3 flex-1 overflow-hidden rounded-sm bg-secondary">
                  <span className="h-full bg-foreground/25" style={{ width: `${(latency / maxLatency) * 100}%` }} />
                  <span
                    className="absolute inset-y-0 left-0 bg-accent"
                    style={{ width: `${(Math.min(ttft, latency) / maxLatency) * 100}%` }}
                  />
                </span>
                <span className="w-14 shrink-0 text-right font-mono text-xs">{formatMs(latency)}</span>
              </li>
            )
          })}
        </ol>
        <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <span className="size-2 rounded-sm bg-accent" aria-hidden="true" /> time to first token
        </p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="models-heading">
        <h3 id="models-heading" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          models used
        </h3>
        <ul className="flex flex-col">
          {Object.entries(modelCounts).map(([model, count]) => (
            <li
              key={model}
              className="flex items-center justify-between border-b border-sidebar-border py-2 font-mono text-xs"
            >
              <span title={model}>{modelLabel(model)}</span>
              <span className="text-muted-foreground">{count}×</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
