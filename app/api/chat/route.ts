import { DEFAULT_MODEL, isModelId } from '@/lib/chat-types'

type ProviderMessage = { role: 'user' | 'assistant'; content: string }

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY ?? process.env.NEXT_PUBLIC_GROQ_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'Missing GROQ_API_KEY environment variable.' }, { status: 500 })
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }
  if (payload == null || typeof payload !== 'object') {
    return Response.json({ error: 'Request body must be a JSON object.' }, { status: 400 })
  }
  const body = payload as { messages?: ProviderMessage[]; model?: unknown }

  const messages = Array.isArray(body.messages)
    ? body.messages.filter(
        (message): message is ProviderMessage =>
          message != null &&
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string' &&
          message.content.length > 0,
      )
    : []
  if (messages.length === 0) {
    return Response.json({ error: 'At least one valid message is required.' }, { status: 400 })
  }

  const modelId = isModelId(body.model) ? body.model : DEFAULT_MODEL
  let upstream: Response
  try {
    upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: req.signal,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reach the Groq API.'
    return Response.json({ error: message }, { status: 502 })
  }

  if (!upstream.ok) {
    const details = await upstream.text()
    let message = `Groq API returned ${upstream.status}.`
    try {
      const payload = JSON.parse(details) as { error?: { message?: string } | string }
      if (typeof payload.error === 'string') message = payload.error
      else if (payload.error?.message) message = payload.error.message
    } catch {
      if (details) message = details
    }
    return Response.json({ error: message }, { status: upstream.status })
  }

  if (!upstream.body) {
    return Response.json({ error: 'Groq returned an empty response stream.' }, { status: 502 })
  }

  const headers = new Headers({
    'Content-Type': upstream.headers.get('content-type') ?? 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  })
  const requestId = upstream.headers.get('x-request-id')
  if (requestId) headers.set('X-Request-Id', requestId)

  return new Response(upstream.body, { headers })
}
