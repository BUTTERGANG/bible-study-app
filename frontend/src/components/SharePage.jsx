import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../api/client'

export default function SharePage() {
  const { token } = useParams()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token) return
    api.resolveShare(token).then(data => setSession(data)).catch(e => setError(e.message || 'Failed to load')).finally(() => setLoading(false))
  }, [token])

  if (loading) return <div className="share-page loading">Loading shared study session…</div>
  if (error) return <div className="share-page error">{error}</div>
  if (!session) return <div className="share-page empty">Session not found or expired.</div>

  const ref = `${session.book} ${session.chapter}`

  return (
    <div className="share-page">
      <h1>{ref}</h1>
      <p className="share-translation">{session.translation}</p>
      <div className="share-passage">
        {session.passage?.map(v => (<span key={v.verse} className="share-verse"><sup>{v.verse}</sup> {v.text}{' '}</span>))}
      </div>
      {session.notes?.length > 0 && (
        <div className="share-notes">
          <h2>Notes</h2>
          {session.notes.map(n => (
            <div key={n.id} className="share-note">
              <strong>{n.book} {n.chapter}{n.verse ? `:${n.verse}` : ''}</strong>
              <p>{n.content}</p>
              {n.tags && <span className="share-note-tags">{n.tags}</span>}
            </div>
          ))}
        </div>
      )}
      {session.ai_conversation && (
        <div className="share-ai">
          <h2>AI Study Summary</h2>
          <p>{session.ai_conversation.messages_summary || 'AI conversation attached.'}</p>
        </div>
      )}
      <div className="share-meta">
        <p>Viewed {session.view_count} times</p>
        {session.expires_at && <p>Expires {new Date(session.expires_at).toLocaleDateString()}</p>}
      </div>
    </div>
  )
}
