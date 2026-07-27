import { useState } from 'react';
import { SAMPLE_BREWS, RECIPES, BREW_METHODS } from '../data/recipes';
import Stars from '../components/Stars';

export default function JournalScreen() {
  const [view, setView] = useState('history');

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Journal</h1>
        <p>Your brewing history and insights</p>
      </div>

      <div className="tab-toggle">
        <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>History</button>
        <button className={view === 'stats' ? 'active' : ''} onClick={() => setView('stats')}>Stats</button>
      </div>

      {view === 'history' && <HistoryView />}
      {view === 'stats' && <StatsView />}
    </div>
  );
}

function HistoryView() {
  return (
    <>
      {SAMPLE_BREWS.map((brew) => {
        const recipe = RECIPES.find((r) => r.id === brew.recipeId);
        const method = BREW_METHODS.find((m) => m.id === recipe?.method);
        return (
          <div key={brew.id} className="card history-card" style={{ display: 'flex', gap: 14 }}>
            <div style={{
              width: 44, height: 44,
              borderRadius: 12,
              background: 'var(--accent-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
            }}>
              {method?.icon || '☕'}
            </div>
            <div style={{ flex: 1 }}>
              <div className="brew-date">{brew.date}</div>
              <div className="brew-bean">{brew.bean}</div>
              <div className="brew-roaster">
                {brew.roaster} · {recipe?.name} · {brew.grind}
              </div>
              <div style={{ margin: '4px 0' }}>
                <Stars rating={brew.rating} size={13} />
              </div>
              <div className="brew-notes">{brew.notes}</div>
              <div className="brew-flavors">
                {brew.flavors.map((f) => (
                  <span key={f} className="tag tag-teal">{f}</span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function StatsView() {
  const totalBrews = SAMPLE_BREWS.length;
  const avgRating = (SAMPLE_BREWS.reduce((s, b) => s + b.rating, 0) / totalBrews).toFixed(1);

  const methodCounts = {};
  SAMPLE_BREWS.forEach((b) => {
    const recipe = RECIPES.find((r) => r.id === b.recipeId);
    if (recipe) {
      methodCounts[recipe.method] = (methodCounts[recipe.method] || 0) + 1;
    }
  });

  const topMethod = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0];
  const topMethodName = BREW_METHODS.find((m) => m.id === topMethod?.[0])?.name || 'N/A';

  const flavorCounts = {};
  SAMPLE_BREWS.forEach((b) => {
    b.flavors.forEach((f) => {
      flavorCounts[f] = (flavorCounts[f] || 0) + 1;
    });
  });
  const topFlavors = Object.entries(flavorCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxFlavorCount = topFlavors[0]?.[1] || 1;

  return (
    <>
      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-value">{totalBrews}</div>
          <div className="stat-label">Total Brews</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{avgRating}</div>
          <div className="stat-label">Avg Rating</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{topMethodName}</div>
          <div className="stat-label">Favorite</div>
        </div>
      </div>

      {/* Method breakdown */}
      <div className="card">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Methods Used</h3>
        {Object.entries(methodCounts).map(([methodId, count]) => {
          const m = BREW_METHODS.find((b) => b.id === methodId);
          const pct = Math.round((count / totalBrews) * 100);
          return (
            <div key={methodId} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{m?.icon} {m?.name}</span>
                <span style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{count} brews · {pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-card)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: 'var(--accent)', transition: 'width 0.5s' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Flavor profile */}
      <div className="card">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Flavor Profile</h3>
        {topFlavors.map(([flavor, count]) => (
          <div key={flavor} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{flavor}</span>
              <span style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{count}x</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-card)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(count / maxFlavorCount) * 100}%`, borderRadius: 3, background: 'var(--teal)', transition: 'width 0.5s' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Personal bests */}
      <div className="card">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Personal Bests</h3>
        {SAMPLE_BREWS.filter((b) => b.rating === 5).map((brew) => {
          const recipe = RECIPES.find((r) => r.id === brew.recipeId);
          return (
            <div key={brew.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 18 }}>🏆</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{brew.bean}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{recipe?.name} · {brew.date}</div>
              </div>
              <Stars rating={brew.rating} size={12} />
            </div>
          );
        })}
      </div>
    </>
  );
}
