'use client'

import { X } from 'lucide-react'
import { useState } from 'react'
import type { ChatMessage } from '@/lib/chat-types'
import { cn } from '@/lib/utils'
import { ResponsePanel } from './response-panel'
import { StatsPanel } from './stats-panel'

const TABS = [
  { id: 'response', label: 'Response' },
  { id: 'stats', label: 'Statistics' },
] as const

type TabId = (typeof TABS)[number]['id']

type InspectorProps = {
  id: string
  open: boolean
  onClose: () => void
  selected: ChatMessage | null
  responses: ChatMessage[]
  onSelect: (id: string) => void
}

export function Inspector({ id, open, onClose, selected, responses, onSelect }: InspectorProps) {
  const [tab, setTab] = useState<TabId>('response')

  return (
    <aside
      id={id}
      aria-label="Response inspector"
      className={cn(
        'fixed inset-0 z-40 flex-col bg-sidebar text-sidebar-foreground lg:static lg:z-auto lg:flex lg:w-104 lg:shrink-0 lg:border-l lg:border-sidebar-border',
        open ? 'flex' : 'hidden',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-4">
        <div role="tablist" aria-label="Inspector views" className="flex gap-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                '-mb-px border-b-2 py-3 font-mono text-xs uppercase tracking-wider',
                tab === t.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground lg:hidden"
        >
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Close inspector</span>
        </button>
      </div>

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {tab === 'response' ? (
          <ResponsePanel message={selected} responses={responses} onSelect={onSelect} />
        ) : (
          <StatsPanel responses={responses} onSelect={(rid) => { onSelect(rid); setTab('response') }} />
        )}
      </div>
    </aside>
  )
}
