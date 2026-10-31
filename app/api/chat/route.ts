import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from 'ai'
import {
  DEFAULT_MODEL,
  isModelId,
  type ChatMessage,
  type ChatMetadata,
} from '@/lib/chat-types'

export const maxDuration = 60

type StepSnapshot = Pick<
  ChatMetadata,
  'responseId' | 'responseModelId' | 'responseHeaders' | 'providerMetadata' | 'performance'
>

function readGatewayCost(providerMetadata: unknown): number | undefined {
  const gateway = (providerMetadata as { gateway?: { cost?: unknown } } | undefined)?.gateway
  const cost = Number(gateway?.cost)
  return Number.isFinite(cost) ? cost : undefined
}

export async function POST(req: Request) {
  const body: { messages?: ChatMessage[]; model?: unknown } = await req.json()
  const messages = Array.isArray(body.messages) ? body.messages : []
  const modelId = isModelId(body.model) ? body.model : DEFAULT_MODEL
  const startedAt = Date.now()

  const result = streamText({
    model: modelId,
    instructions: 'You are a helpful, concise assistant.',
    messages: await convertToModelMessages(messages),
  })

  let steps = 0
  let lastStep: StepSnapshot = {}

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      onError: (error) => (error instanceof Error ? error.message : 'An error occurred.'),
      messageMetadata: ({ part }) => {
        if (part.type === 'start') {
          return { createdAt: startedAt, model: modelId }
        }

        if (part.type === 'finish-step') {
          steps += 1
          lastStep = {
            responseId: part.response.id,
            responseModelId: part.response.modelId,
            responseHeaders: part.response.headers,
            providerMetadata: part.providerMetadata,
            performance: {
              timeToFirstOutputMs: part.performance.timeToFirstOutputMs,
              outputTokensPerSecond: part.performance.outputTokensPerSecond,
              responseTimeMs: part.performance.responseTimeMs,
            },
          }
          return undefined
        }

        if (part.type === 'finish') {
          const usage = part.totalUsage
          return {
            ...lastStep,
            completedAt: Date.now(),
            finishReason: part.finishReason,
            steps,
            cost: readGatewayCost(lastStep.providerMetadata),
            usage: {
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              totalTokens: usage.totalTokens,
              reasoningTokens: usage.outputTokenDetails.reasoningTokens,
              cachedInputTokens: usage.inputTokenDetails.cacheReadTokens,
            },
          }
        }

        return undefined
      },
    }),
  })
}
