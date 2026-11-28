import { BREW_METHODS } from '../data/recipes';
import Stars from './Stars';

export default function RecipeCard({ recipe, onClick }) {
  const method = BREW_METHODS.find((m) => m.id === recipe.method);
  return (
    <div className="card recipe-card" onClick={() => onClick(recipe)}>
      <div className="recipe-icon-wrap">{method?.icon || '☕'}</div>
      <div className="recipe-info">
        <div className="recipe-name">{recipe.name}</div>
        <div className="recipe-meta">
          <span>{recipe.ratio} · {recipe.dose}g</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Stars rating={recipe.rating} size={11} />
            <span>{recipe.rating}</span>
          </span>
        </div>
        <div className="recipe-tags">
          {recipe.tags.map((t) => (
            <span key={t} className="tag tag-accent">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
