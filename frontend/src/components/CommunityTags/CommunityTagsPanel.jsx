import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '../../api/client'

export default function CommunityTagsPanel({ book, chapter, verse, resourceId }) {
  const [tags, setTags] = useState([])
  const [tagCloud, setTagCloud] = useState([])
  const [newTag, setNewTag] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [loading, setLoading] = useState(true)

  const params = useMemo(() => resourceId ? { resource_id: resourceId } : { book, chapter, verse }, [resourceId, book, chapter, verse])

  const fetchTags = useCallback(() => {
    api.listTags(params).then(r => { const d = r.data ?? r; setTags(d.tags || []); setTagCloud(d.tag_cloud || []) }).catch(() => {}).finally(() => setLoading(false))
  }, [params])

  useEffect(() => { fetchTags() }, [fetchTags])

  const handleAddTag = async () => {
    if (!newTag.trim()) return
    try { await api.createTag({ ...params, tag_text: newTag.trim() }); setNewTag(''); fetchTags() } catch {}
  }

  const handleUpvote = async (tagId) => {
    try { await api.upvoteTag(tagId); fetchTags() } catch {}
  }

  const handleDelete = async (tagId) => {
    try { await api.deleteTag(tagId); fetchTags() } catch {}
  }

  const handleSearch = () => {
    if (!searchQ.trim()) { setSearchResults(null); return }
    api.searchTags(searchQ.trim()).then(r => setSearchResults((r.data ?? r).results || [])).catch(() => {})
  }

  return (
    <div className="community-tags-panel">
      {tagCloud.length > 0 && (
        <div className="tag-cloud">
          {tagCloud.map(tc => (
            <span key={tc.tag_text} className="tag-cloud-chip" style={{ fontSize: `${Math.min(14 + tc.count * 2, 28)}px` }}>{tc.tag_text} ({tc.count})</span>
          ))}
        </div>
      )}
      <div className="tag-input-row">
        <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Add a tag…" maxLength={100} onKeyDown={e => e.key === 'Enter' && handleAddTag()} />
        <button onClick={handleAddTag} disabled={!newTag.trim()}>+</button>
      </div>
      {!loading && tags.map(t => (
        <div key={t.id} className="tag-item">
          <span className="tag-text">{t.tag_text}</span>
          <button className="tag-upvote" onClick={() => handleUpvote(t.id)}>{t.has_upvoted ? '▲' : '△'} {t.upvotes}</button>
          {t.is_own && <button className="tag-delete" onClick={() => handleDelete(t.id)}>×</button>}
        </div>
      ))}
      <div className="tag-search-row">
        <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search by tag…" onKeyDown={e => e.key === 'Enter' && handleSearch()} />
        <button onClick={handleSearch}>Search</button>
      </div>
      {searchResults && (
        <div className="tag-search-results">
          {searchResults.map((r, i) => <div key={i} className="tag-search-result">{r.reference}</div>)}
        </div>
      )}
    </div>
  )
}
