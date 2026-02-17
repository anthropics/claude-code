import { useState } from 'react'
import StarRating from './StarRating'
import { X } from 'lucide-react'

const DIFFICULTY_OPTIONS = ['Easy', 'Moderate', 'Hard', 'Strenuous']
const WEATHER_OPTIONS = ['Sunny', 'Cloudy', 'Rainy', 'Windy', 'Snowy', 'Foggy']
const TAG_OPTIONS = ['Coastal', 'Forest', 'Urban', 'Lake', 'River', 'Mountain', 'Beach', 'Park', 'Trail', 'Scenic']

const emptyForm = {
  name: '',
  location: '',
  date: new Date().toISOString().split('T')[0],
  rating: 0,
  partner_rating: 0,
  notes: '',
  distance_km: '',
  difficulty: '',
  weather: '',
  tags: [],
  photos: [],
  runkeeper_image: '',
}

export default function WalkForm({ onSubmit, initial, onCancel }) {
  const [form, setForm] = useState(initial || emptyForm)

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const toggleTag = (tag) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }))
  }

  const handleImageUpload = (e, field) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => set(field, reader.result)
    reader.readAsDataURL(file)
  }

  const handlePhotos = (e) => {
    const files = Array.from(e.target.files)
    Promise.all(
      files.map(file => new Promise(resolve => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.readAsDataURL(file)
      }))
    ).then(results => {
      setForm(prev => ({ ...prev, photos: [...prev.photos, ...results] }))
    })
  }

  const removePhoto = (idx) => {
    setForm(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== idx),
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name || !form.rating) return
    onSubmit({
      ...form,
      distance_km: form.distance_km ? parseFloat(form.distance_km) : null,
    })
  }

  return (
    <form className="walk-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Walk Name *</label>
        <input
          type="text"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. Peggy's Cove Loop"
          required
        />
      </div>

      <div className="form-group">
        <label>Location</label>
        <input
          type="text"
          value={form.location}
          onChange={e => set('location', e.target.value)}
          placeholder="e.g. Peggy's Cove, NS"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Date</label>
          <input
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Distance (km)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={form.distance_km}
            onChange={e => set('distance_km', e.target.value)}
            placeholder="5.2"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Your Rating *</label>
          <StarRating rating={form.rating} onChange={val => set('rating', val)} />
        </div>
        <div className="form-group">
          <label>Partner's Rating</label>
          <StarRating rating={form.partner_rating} onChange={val => set('partner_rating', val)} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Difficulty</label>
          <select value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
            <option value="">Select...</option>
            {DIFFICULTY_OPTIONS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Weather</label>
          <select value={form.weather} onChange={e => set('weather', e.target.value)}>
            <option value="">Select...</option>
            {WEATHER_OPTIONS.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Tags</label>
        <div className="tags-grid">
          {TAG_OPTIONS.map(tag => (
            <button
              key={tag}
              type="button"
              className={`tag-btn ${form.tags.includes(tag) ? 'active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Notes</label>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="How was the walk? Any highlights?"
          rows={3}
        />
      </div>

      <div className="form-group">
        <label>RunKeeper Route Screenshot</label>
        <input
          type="file"
          accept="image/*"
          onChange={e => handleImageUpload(e, 'runkeeper_image')}
        />
        {form.runkeeper_image && (
          <div className="image-preview runkeeper-preview">
            <img src={form.runkeeper_image} alt="RunKeeper route" />
            <button type="button" className="remove-btn" onClick={() => set('runkeeper_image', '')}>
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="form-group">
        <label>Photos</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotos}
        />
        {form.photos.length > 0 && (
          <div className="photos-grid">
            {form.photos.map((photo, idx) => (
              <div key={idx} className="image-preview">
                <img src={photo} alt={`Walk photo ${idx + 1}`} />
                <button type="button" className="remove-btn" onClick={() => removePhoto(idx)}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {initial ? 'Update Walk' : 'Save Walk'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
