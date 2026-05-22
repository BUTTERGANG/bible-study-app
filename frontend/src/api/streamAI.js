// SSE streaming for /api/ai/*. Emits chunks as they arrive; calls onDone
// at the end (with an Error argument on failure). Returns an abort function.
//
// SSE events end with `\n\n`; events can split across read() boundaries, so we
// buffer until we see a terminator instead of splitting each read by `\n`.
//
// Retries up to MAX_RETRIES times with exponential backoff on network errors
// (not on HTTP 4xx, which are client errors that won't benefit from retry).

import { authHeaders } from './client'

const MAX_RETRIES = 2
const BASE_DELAY_MS = 1000

function isRetryable(status) {
  // Retry on rate-limit (429) and server errors (5xx), not client errors
  return status === 429 || status >= 500
}

export function streamAI(endpoint, body, onChunk, onDone) {
  const controller = new AbortController()
  let attempt = 0

  function doFetch() {
    attempt++

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
          // Retry on transient server errors
          if (isRetryable(res.status) && attempt <= MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
            onChunk?.(`\n[Retrying in ${delay / 1000}s…]\n`)
            setTimeout(doFetch, delay)
            return
          }
          throw new Error(detail)
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let serverError = null

        // Read loop — use a recursive pattern so we can await properly
        function readLoop() {
          return reader.read().then(({ done, value }) => {
            if (done) {
              onDone?.(serverError)
              return
            }
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
            return readLoop()
          })
        }

        return readLoop()
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        // Retry on network errors (TypeError from fetch)
        if (err instanceof TypeError && attempt <= MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
          onChunk?.(`\n[Connection failed — retrying in ${delay / 1000}s…]\n`)
          setTimeout(doFetch, delay)
          return
        }
        onDone?.(err)
      })
  }

  doFetch()

  return () => controller.abort()
}
