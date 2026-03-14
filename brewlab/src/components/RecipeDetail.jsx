import { BREW_METHODS } from '../data/recipes';
import Stars from './Stars';

function formatTime(seconds) {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    return `${h}h`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${m}:00`;
}

export default function RecipeDetail({ recipe, onClose, onBrew }) {
  const method = BREW_METHODS.find((m) => m.id === recipe.method);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div className="recipe-icon-wrap" style={{ width: 44, height: 44, fontSize: 20 }}>
            {method?.icon || '☕'}
          </div>
          <div>
            <h2>{recipe.name}</h2>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              by {recipe.author} · <Stars rating={recipe.rating} size={12} /> {recipe.rating} ({recipe.reviews})
            </div>
          </div>
        </div>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '12px 0 16px' }}>
          {recipe.description}
        </p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <span className="tag tag-teal">{recipe.difficulty}</span>
          {recipe.tags.map((t) => <span key={t} className="tag">{t}</span>)}
        </div>

        <div className="recipe-stats">
          <div className="recipe-stat">
            <div className="rs-value">{recipe.dose}g</div>
            <div className="rs-label">Dose</div>
          </div>
          <div className="recipe-stat">
            <div className="rs-value">{recipe.water}g</div>
            <div className="rs-label">Water</div>
          </div>
          <div className="recipe-stat">
            <div className="rs-value">{recipe.ratio}</div>
            <div className="rs-label">Ratio</div>
          </div>
          <div className="recipe-stat">
            <div className="rs-value">{recipe.grind}</div>
            <div className="rs-label">Grind</div>
          </div>
          <div className="recipe-stat">
            <div className="rs-value">{recipe.temp}°C</div>
            <div className="rs-label">Temp</div>
          </div>
          <div className="recipe-stat">
            <div className="rs-value">{formatTime(recipe.totalTime)}</div>
            <div className="rs-label">Time</div>
          </div>
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>Steps</h3>
        <div className="steps-list">
          {recipe.steps.map((step, i) => (
            <div key={i} className="step-item">
              <div className="step-num">{i + 1}</div>
              <div className="step-content">
                <div className="step-name">{step.label}</div>
                <div className="step-desc">{step.instruction}</div>
                <div className="step-time">
                  {step.duration >= 60
                    ? `${Math.floor(step.duration / 60)}m ${step.duration % 60 > 0 ? `${step.duration % 60}s` : ''}`
                    : `${step.duration}s`}
                  {step.targetWeight && ` · Target: ${step.targetWeight}g`}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn btn-primary btn-full" onClick={() => onBrew(recipe)}>
            ▶ Brew This
          </button>
        </div>
      </div>
    </div>
  );
}
