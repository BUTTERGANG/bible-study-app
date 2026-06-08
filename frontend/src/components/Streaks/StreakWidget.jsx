import { useEffect, useState } from 'react'
import { api } from '../../api/client'

const BADGE_ICONS = { 7: '🔥', 30: '⭐', 100: '💎', 365: '👑' }
const BADGE_LABELS = { 7: '7 Days', 30: '30 Days', 100: '100 Days', 365: '1 Year' }

export default function StreakWidget() {
  const [streak, setStreak] = useState(null)
  const [shareText, setShareText] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getStreak()
      .then(r => setStreak(r.data ?? r))
      .catch(() => setStreak(null))
      .finally(() => setLoading(false))
  }, [])

  const handleShare = async () => {
    try {
      const r = await api.getStreakShare()
      const data = r.data ?? r
      setShareText(data.share_text)
      await navigator.clipboard.writeText(data.share_text)
    } catch {}
  }

  if (loading) return <div className="streak-widget loading">…</div>
  if (!streak) return null

  return (
    <div className="streak-widget">
      <div className="streak-numbers">
        <div className="streak-current">
          <span className="streak-count">{streak.current_streak}</span>
          <span className="streak-label">day streak</span>
        </div>
        <div className="streak-longest">Best: {streak.longest_streak} days</div>
      </div>
      {streak.badges?.length > 0 && (
        <div className="streak-badges">
          {streak.badges.map(b => (
            <span key={b.milestone} className="streak-badge" title={BADGE_LABELS[b.milestone]}>
              {BADGE_ICONS[b.milestone] || '🏅'}
            </span>
          ))}
        </div>
      )}
      {streak.current_streak > 0 && (
        <button className="streak-share-btn" onClick={handleShare}>Share Streak</button>
      )}
      {shareText && <div className="streak-share-confirm">Copied to clipboard!</div>}
    </div>
  )
}
