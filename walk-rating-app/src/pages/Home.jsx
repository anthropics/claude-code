import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import WalkCard from '../components/WalkCard'
import WalkForm from '../components/WalkForm'
import { getWalks, addWalk, updateWalk, deleteWalk } from '../lib/storage'

export default function Home() {
  const [walks, setWalks] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWalks()
  }, [])

  async function loadWalks() {
    try {
      const data = await getWalks()
      setWalks(data)
    } catch (err) {
      console.error('Failed to load walks:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(walk) {
    try {
      await addWalk(walk)
      await loadWalks()
      setShowForm(false)
    } catch (err) {
      console.error('Failed to add walk:', err)
    }
  }

  async function handleUpdate(walk) {
    try {
      await updateWalk(editing.id, walk)
      await loadWalks()
      setEditing(null)
    } catch (err) {
      console.error('Failed to update walk:', err)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this walk?')) return
    try {
      await deleteWalk(id)
      await loadWalks()
    } catch (err) {
      console.error('Failed to delete walk:', err)
    }
  }

  const filtered = walks.filter(w => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (
      w.name.toLowerCase().includes(q) ||
      (w.location && w.location.toLowerCase().includes(q)) ||
      (w.tags && w.tags.some(t => t.toLowerCase().includes(q)))
    )
  })

  const totalWalks = walks.length
  const totalKm = walks.reduce((sum, w) => sum + (w.distance_km || 0), 0)
  const avgRating = walks.length
    ? (walks.reduce((sum, w) => sum + w.rating, 0) / walks.length).toFixed(1)
    : '—'

  if (loading) {
    return <div className="loading">Loading your walks...</div>
  }

  return (
    <div className="home">
      <div className="stats-bar">
        <div className="stat">
          <span className="stat-value">{totalWalks}</span>
          <span className="stat-label">Walks</span>
        </div>
        <div className="stat">
          <span className="stat-value">{totalKm.toFixed(1)}</span>
          <span className="stat-label">Total km</span>
        </div>
        <div className="stat">
          <span className="stat-value">{avgRating}</span>
          <span className="stat-label">Avg Rating</span>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="Search walks..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <button
          className="btn btn-primary add-btn"
          onClick={() => { setShowForm(true); setEditing(null) }}
        >
          <Plus size={18} /> Add Walk
        </button>
      </div>

      {(showForm || editing) && (
        <div className="form-overlay">
          <div className="form-container">
            <h2>{editing ? 'Edit Walk' : 'New Walk'}</h2>
            <WalkForm
              onSubmit={editing ? handleUpdate : handleAdd}
              initial={editing || undefined}
              onCancel={() => { setShowForm(false); setEditing(null) }}
            />
          </div>
        </div>
      )}

      <div className="walks-list">
        {filtered.length === 0 && (
          <div className="empty-state">
            {walks.length === 0
              ? 'No walks yet — go explore Nova Scotia!'
              : 'No walks match your search.'}
          </div>
        )}
        {filtered.map(walk => (
          <WalkCard
            key={walk.id}
            walk={walk}
            onEdit={setEditing}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  )
}
