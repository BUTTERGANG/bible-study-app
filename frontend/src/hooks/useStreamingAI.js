import { useCallback, useEffect, useRef, useState } from 'react'
import { streamAI } from '../api/streamAI'

// Conversational streaming hook for the AI assistant.
//   const { messages, streaming, send, stop, clear } = useStreamingAI('ask')
//
// `bodyFor(prompt, prior)` builds the request payload — it receives the
// current user prompt and the array of prior {role, content} turns.
export function useStreamingAI(endpoint, bodyFor) {
  const [messages, setMessages] = useState([])
  const [streaming, setStreaming] = useState(false)
  const stopRef = useRef(null)

  // Abort any active stream on unmount.
  useEffect(() => () => stopRef.current?.(), [])

  const send = useCallback(
    (text) => {
      if (!text.trim() || streaming) return
      const userMsg = { role: 'user', content: text }
      const aiMsg = { role: 'assistant', content: '', error: null }
      setMessages((prev) => [...prev, userMsg, aiMsg])
      setStreaming(true)

      const history = messages
        .filter((m) => !m.error)
        .map((m) => ({ role: m.role, content: m.content }))

      stopRef.current = streamAI(
        endpoint,
        bodyFor(text, history),
        (chunk) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
          })
        },
        (err) => {
          if (err) {
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              return [...prev.slice(0, -1), { ...last, error: err.message || String(err) }]
            })
          }
          setStreaming(false)
        }
      )
    },
    [endpoint, bodyFor, messages, streaming]
  )

  const stop = useCallback(() => {
    stopRef.current?.()
    setStreaming(false)
  }, [])

  const clear = useCallback(() => {
    stopRef.current?.()
    setMessages([])
    setStreaming(false)
  }, [])

  return { messages, streaming, send, stop, clear }
}
