import { useState } from 'react'
import StarRating from './StarRating'
import { MapPin, Calendar, Ruler, Mountain, Cloud, Trash2, Edit, ChevronDown, ChevronUp } from 'lucide-react'

export default function WalkCard({ walk, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  const avgRating = walk.partner_rating
    ? ((walk.rating + walk.partner_rating) / 2).toFixed(1)
    : walk.rating

  return (
    <div className="walk-card">
      <div className="card-header" onClick={() => setExpanded(!expanded)}>
        <div className="card-title-row">
          <h3>{walk.name}</h3>
          <div className="card-avg-rating">
            <span className="avg-label">avg</span>
            <span className="avg-value">{avgRating}</span>
            <span className="avg-star">&#9733;</span>
          </div>
        </div>

        <div className="card-meta">
          {walk.location && (
            <span className="meta-item">
              <MapPin size={14} /> {walk.location}
            </span>
          )}
          {walk.date && (
            <span className="meta-item">
              <Calendar size={14} /> {new Date(walk.date).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          )}
          {walk.distance_km && (
            <span className="meta-item">
              <Ruler size={14} /> {walk.distance_km} km
            </span>
          )}
          {walk.difficulty && (
            <span className="meta-item">
              <Mountain size={14} /> {walk.difficulty}
            </span>
          )}
          {walk.weather && (
            <span className="meta-item">
              <Cloud size={14} /> {walk.weather}
            </span>
          )}
        </div>

        <div className="card-ratings">
          <div className="rating-row">
            <span className="rating-label">You:</span>
            <StarRating rating={walk.rating} size={16} />
          </div>
          {walk.partner_rating > 0 && (
            <div className="rating-row">
              <span className="rating-label">Partner:</span>
              <StarRating rating={walk.partner_rating} size={16} />
            </div>
          )}
        </div>

        <button className="expand-btn" type="button">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {expanded && (
        <div className="card-details">
          {walk.tags && walk.tags.length > 0 && (
            <div className="card-tags">
              {walk.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          )}

          {walk.notes && <p className="card-notes">{walk.notes}</p>}

          {walk.runkeeper_image && (
            <div className="card-runkeeper">
              <h4>RunKeeper Route</h4>
              <img src={walk.runkeeper_image} alt="RunKeeper route" />
            </div>
          )}

          {walk.photos && walk.photos.length > 0 && (
            <div className="card-photos">
              <h4>Photos</h4>
              <div className="photos-grid">
                {walk.photos.map((photo, idx) => (
                  <img key={idx} src={photo} alt={`Walk photo ${idx + 1}`} />
                ))}
              </div>
            </div>
          )}

          <div className="card-actions">
            <button className="btn btn-small btn-secondary" onClick={() => onEdit(walk)}>
              <Edit size={14} /> Edit
            </button>
            <button className="btn btn-small btn-danger" onClick={() => onDelete(walk.id)}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
