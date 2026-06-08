import { useState } from 'react'
import { api } from '../../api/client'

export default function ShareButton({ book, chapter, noteIds = [], aiConversationId = null }) {
  const [sharing, setSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    setSharing(true)
    try {
      const r = await api.createShare({ book, chapter, note_ids: noteIds, ai_conversation_id: aiConversationId })
      const data = r.data ?? r
      setShareUrl(data.url)
      await navigator.clipboard.writeText(data.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {} finally { setSharing(false) }
  }

  return (
    <div className="share-button-wrap">
      <button className="share-btn" onClick={handleShare} disabled={sharing}>{sharing ? 'Sharing…' : '🔗 Share'}</button>
      {copied && <span className="share-copied">Link copied!</span>}
      {shareUrl && !copied && <span className="share-url">{shareUrl}</span>}
    </div>
  )
}
