// SSE streaming for /api/ai/*. Emits chunks as they arrive; calls onDone
// at the end (with an Error argument on failure). Returns an abort function.
//
// SSE events end with `\n\n`; events can split across read() boundaries, so we
// buffer until we see a terminator instead of splitting each read by `\n`.

import { authHeaders } from './client'

export function streamAI(endpoint, body, onChunk, onDone) {
  const controller = new AbortController()

  fetch(`/api/ai/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        let detail = `${res.status} ${res.statusText}`
        try {
          const j = await res.json()
          if (j?.detail) detail = j.detail
        } catch {}
        throw new Error(detail)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let serverError = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let sep
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)

          for (const rawLine of event.split('\n')) {
            if (!rawLine.startsWith('data: ')) continue
            const data = rawLine.slice(6)
            if (data === '[DONE]') {
              onDone?.(serverError)
              return
            }
            try {
              const parsed = JSON.parse(data)
              if (parsed.text) onChunk(parsed.text)
              if (parsed.error) serverError = new Error(parsed.error)
            } catch {}
          }
        }
      }
      onDone?.(serverError)
    })
    .catch((err) => {
      if (err.name !== 'AbortError') onDone?.(err)
    })

  return () => controller.abort()
}
