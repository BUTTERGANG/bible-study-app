import { useState } from 'react'
import { api } from '../../api/client'

export default function ThreadReplies({ groupId, noteId, replies: initialReplies, onNewReply }) {
  const [replies, setReplies] = useState(initialReplies || [])
  const [replyText, setReplyText] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!replyText.trim() || submitting) return
    setSubmitting(true)
    try {
      const r = await api.createGroupNote(groupId, { parent_id: noteId, content: replyText.trim() })
      const data = r.data ?? r
      setReplies(prev => [...prev, data])
      setReplyText('')
      if (onNewReply) onNewReply(data)
    } catch {} finally { setSubmitting(false) }
  }

  return (
    <div className="thread-replies">
      {replies.length > 0 && !expanded && (
        <button className="thread-expand" onClick={() => setExpanded(true)}>
          {replies.length} {replies.length === 1 ? 'reply' : 'replies'} — click to expand
        </button>
      )}
      {expanded && replies.map(r => (
        <div key={r.id} className="thread-reply">
          <span className="reply-author">{r.author_email || 'User'}</span>
          <p className="reply-content">{r.content}</p>
          <span className="reply-time">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</span>
        </div>
      ))}
      <div className="thread-reply-input">
        <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply…" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        <button onClick={handleSubmit} disabled={!replyText.trim() || submitting}>Reply</button>
      </div>
    </div>
  )
}
