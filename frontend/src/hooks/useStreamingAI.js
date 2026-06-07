import { useCallback, useEffect, useRef, useState } from 'react'
import { streamAI } from '../api/streamAI'

// Conversational streaming hook for the AI assistant.
//   const [messages, setMessages] = useState([])
//   const { streaming, send, stop, clear } = useStreamingAI('ask', bodyFor, messages, setMessages)
//
// `bodyFor(prompt, prior)` builds the request payload — it receives the
// current user prompt and the array of prior {role, content} turns.
export function useStreamingAI(endpoint, bodyFor, messages, setMessages) {
  const [streaming, setStreaming] = useState(false)
  const stopRef = useRef(null)

  // Abort any active stream on unmount.
  useEffect(() => () => stopRef.current?.(), [])

  const send = useCallback(
    (text) => {
      if (!text.trim() || streaming) return
      const userMsg = { role: 'user', content: text }
      const aiMsg = { role: 'assistant', content: '', error: null }
      setStreaming(true)
      setMessages((prev) => {
        // Build history from the previous state (always fresh) before appending
        const history = prev
          .filter((m) => !m.error)
          .map((m) => ({ role: m.role, content: m.content }))

        // Kick off the stream with the correct history
        stopRef.current = streamAI(
          endpoint,
          bodyFor(text, history),
          (chunk) => {
            setMessages((p) => {
              const last = p[p.length - 1]
              return [...p.slice(0, -1), { ...last, content: last.content + chunk }]
            })
          },
          (err) => {
            if (err) {
              setMessages((p) => {
                const last = p[p.length - 1]
                return [...p.slice(0, -1), { ...last, error: err.message || String(err) }]
              })
            }
            setStreaming(false)
          }
        )

        return [...prev, userMsg, aiMsg]
      })
    },
    [endpoint, bodyFor, streaming, setMessages]
  )

  const stop = useCallback(() => {
    stopRef.current?.()
    setStreaming(false)
  }, [])

  const clear = useCallback(() => {
    stopRef.current?.()
    setMessages([])
    setStreaming(false)
  }, [setMessages])

  return { streaming, send, stop, clear }
}
