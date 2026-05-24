import { useState, useRef, useCallback } from 'react'

export interface SSECallbacks {
  onStart?: (data: { model: string; mapped_model: string; prompt_tokens: number }) => void
  onChunk?: (text: string) => void
  onFallback?: (data: { from_model: string; to_model: string; reason: string }) => void
  onDone?: (data: {
    model: string
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    full_text: string
  }) => void
  onError?: (message: string) => void
}

export function useSSE() {
  const [generating, setGenerating] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setGenerating(false)
  }, [])

  const startGeneration = useCallback(
    async (url: string, payload: any, callbacks: SSECallbacks) => {
      stopGeneration() // Clean up any active runs
      setGenerating(true)

      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })

        if (!response.ok) {
          const errText = await response.text()
          throw new Error(errText || `Server returned ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('ReadableStream not supported on this response.')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true })

          // Process the buffer lines
          const lines = buffer.split('\n')
          // Save the last partial line back to the buffer
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (!trimmedLine.startsWith('data: ')) continue

            const jsonStr = trimmedLine.substring(6).trim()
            if (!jsonStr) continue

            try {
              const data = JSON.parse(jsonStr)
              
              switch (data.type) {
                case 'start':
                  if (callbacks.onStart) callbacks.onStart(data)
                  break
                case 'content':
                  if (callbacks.onChunk) callbacks.onChunk(data.text)
                  break
                case 'fallback':
                  if (callbacks.onFallback) callbacks.onFallback(data)
                  break
                case 'done':
                  if (callbacks.onDone) callbacks.onDone(data)
                  setGenerating(false)
                  return
                case 'error':
                  if (callbacks.onError) callbacks.onError(data.message)
                  setGenerating(false)
                  return
                default:
                  break
              }
            } catch (err) {
              console.warn('[warning] Error parsing SSE payload line:', trimmedLine, err)
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('[SSE] Generation aborted by the user.')
        } else {
          if (callbacks.onError) {
            callbacks.onError(err.message || 'Stream processing failed.')
          }
        }
      } finally {
        setGenerating(false)
        abortControllerRef.current = null
      }
    },
    [stopGeneration]
  )

  return {
    generating,
    startGeneration,
    stopGeneration,
  }
}
