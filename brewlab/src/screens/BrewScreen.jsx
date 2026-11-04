import { useState } from 'react';
import { BREW_METHODS, RECIPES, SAMPLE_BREWS } from '../data/recipes';
import RecipeCard from '../components/RecipeCard';
import Stars from '../components/Stars';

export default function BrewScreen({ onSelectRecipe, onStartBrew }) {
  const [selectedMethod, setSelectedMethod] = useState(null);

  const filteredRecipes = selectedMethod
    ? RECIPES.filter((r) => r.method === selectedMethod)
    : RECIPES;

  const recentBrew = SAMPLE_BREWS[0];
  const recentRecipe = RECIPES.find((r) => r.id === recentBrew.recipeId);

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>BrewLab</h1>
        <p>Good morning. Ready to brew?</p>
      </div>

      {/* Hero card */}
      <div className="card card-accent" style={{ cursor: 'pointer' }} onClick={() => recentRecipe && onStartBrew(recentRecipe)}>
        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, marginBottom: 4 }}>QUICK REPEAT</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          {recentRecipe?.name}
        </div>
        <p style={{ fontSize: 13 }}>
          {recentBrew.bean} · {recentRecipe?.ratio} · Rated {recentBrew.rating}★
        </p>
      </div>

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-value">12</div>
          <div className="stat-label">This Week</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">4.3</div>
          <div className="stat-label">Avg Rating</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">V60</div>
          <div className="stat-label">Top Method</div>
        </div>
      </div>

      {/* Method selector */}
      <div className="section-header">
        <h3>Choose Method</h3>
        {selectedMethod && (
          <button onClick={() => setSelectedMethod(null)}>Show All</button>
        )}
      </div>
      <div className="method-scroll">
        {BREW_METHODS.map((m) => (
          <div
            key={m.id}
            className={`method-pill ${selectedMethod === m.id ? 'active' : ''}`}
            onClick={() => setSelectedMethod(selectedMethod === m.id ? null : m.id)}
          >
            <div className="method-icon">{m.icon}</div>
            <div className="method-name">{m.name}</div>
          </div>
        ))}
      </div>

      {/* Recipes for selected method */}
      <div className="section-header">
        <h3>
          {selectedMethod
            ? `${BREW_METHODS.find((m) => m.id === selectedMethod)?.name} Recipes`
            : 'All Recipes'}
        </h3>
      </div>
      {filteredRecipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} onClick={onSelectRecipe} />
      ))}

      {filteredRecipes.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          No recipes yet for this method.
        </div>
      )}
    </div>
  );
}
