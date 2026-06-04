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
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  // Abort any active stream on unmount and reset streaming state.
  useEffect(() => () => {
    stopRef.current?.()
    setStreaming(false)
  }, [])

  const send = useCallback(
    (text) => {
      if (!text.trim() || streaming) return

      // Build history snapshot outside of any state updater to avoid side
      // effects inside React's reconciliation loop (double-invoke in StrictMode).
      const prev = messagesRef.current
      const history = prev
        .filter((m) => !m.error)
        .map((m) => ({ role: m.role, content: m.content }))

      const userMsg = { id: crypto.randomUUID(), role: 'user', content: text }
      const aiMsg = { id: crypto.randomUUID(), role: 'assistant', content: '', error: null }
      setMessages([...prev, userMsg, aiMsg])
      setStreaming(true)

      stopRef.current = streamAI(
        endpoint,
        bodyFor(text, history),
        (chunk) => {
          setMessages((p) => {
            if (!p.length) return p
            const last = p[p.length - 1]
            return [...p.slice(0, -1), { ...last, content: last.content + chunk }]
          })
        },
        (err) => {
          if (err) {
            setMessages((p) => {
              if (!p.length) return p
              const last = p[p.length - 1]
              return [...p.slice(0, -1), { ...last, error: err.message || String(err) }]
            })
          }
          setStreaming(false)
        }
      )
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
