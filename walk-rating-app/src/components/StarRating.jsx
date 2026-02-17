import { Star } from 'lucide-react'

export default function StarRating({ rating, onChange, size = 24 }) {
  const interactive = !!onChange

  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          className={`star-btn ${star <= rating ? 'filled' : ''}`}
          onClick={() => interactive && onChange(star)}
          disabled={!interactive}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          <Star
            size={size}
            fill={star <= rating ? '#f59e0b' : 'none'}
            stroke={star <= rating ? '#f59e0b' : '#d1d5db'}
          />
        </button>
      ))}
    </div>
  )
}
