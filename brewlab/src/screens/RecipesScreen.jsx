import { useState } from 'react';
import { BREW_METHODS, RECIPES } from '../data/recipes';
import RecipeCard from '../components/RecipeCard';

export default function RecipesScreen({ onSelectRecipe }) {
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState(null);

  const filtered = RECIPES.filter((r) => {
    const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesMethod = !filterMethod || r.method === filterMethod;
    return matchesSearch && matchesMethod;
  });

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Recipes</h1>
        <p>Curated and community recipes</p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 'var(--radius-full)',
            border: '1.5px solid var(--border)',
            background: 'var(--bg-elevated)',
            fontFamily: 'inherit',
            fontSize: 14,
            outline: 'none',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Method filter */}
      <div className="method-scroll">
        <div
          className={`method-pill ${!filterMethod ? 'active' : ''}`}
          onClick={() => setFilterMethod(null)}
        >
          <div className="method-icon">☕</div>
          <div className="method-name">All</div>
        </div>
        {BREW_METHODS.map((m) => (
          <div
            key={m.id}
            className={`method-pill ${filterMethod === m.id ? 'active' : ''}`}
            onClick={() => setFilterMethod(filterMethod === m.id ? null : m.id)}
          >
            <div className="method-icon">{m.icon}</div>
            <div className="method-name">{m.name}</div>
          </div>
        ))}
      </div>

      {/* Recipe list */}
      <div className="section-header">
        <h3>{filtered.length} Recipes</h3>
      </div>
      {filtered.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} onClick={onSelectRecipe} />
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          No recipes match your search.
        </div>
      )}
    </div>
  );
}
