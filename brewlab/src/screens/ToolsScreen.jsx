import { useState } from 'react';
import { EXTRACTION_COMPASS } from '../data/recipes';

export default function ToolsScreen() {
  const [activeTool, setActiveTool] = useState(null);

  if (activeTool === 'calculator') return <RatioCalculator onBack={() => setActiveTool(null)} />;
  if (activeTool === 'compass') return <ExtractionCompass onBack={() => setActiveTool(null)} />;
  if (activeTool === 'temp') return <TempGuide onBack={() => setActiveTool(null)} />;

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Tools</h1>
        <p>Smart brewing utilities</p>
      </div>

      <div className="card tool-card" onClick={() => setActiveTool('calculator')}>
        <div className="tool-icon-wrap" style={{ background: 'var(--accent-bg)' }}>
          <span>⚖</span>
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Ratio Calculator</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Calculate dose, water, and ratio instantly</div>
        </div>
      </div>

      <div className="card tool-card" onClick={() => setActiveTool('compass')}>
        <div className="tool-icon-wrap" style={{ background: 'var(--teal-bg)' }}>
          <span>🧭</span>
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Extraction Compass</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Taste-based brew correction guidance</div>
        </div>
      </div>

      <div className="card tool-card" onClick={() => setActiveTool('temp')}>
        <div className="tool-icon-wrap" style={{ background: 'rgba(196, 150, 42, 0.1)' }}>
          <span>🌡</span>
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Water Temp Guide</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Recommended temperatures by method and roast</div>
        </div>
      </div>

      <div className="card tool-card" style={{ opacity: 0.5 }}>
        <div className="tool-icon-wrap" style={{ background: 'var(--bg-card)' }}>
          <span>⚙</span>
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Grind Tracker</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Coming soon — map grinder settings to results</div>
        </div>
      </div>
    </div>
  );
}

function RatioCalculator({ onBack }) {
  const [dose, setDose] = useState(15);
  const [ratio, setRatio] = useState(16);
  const water = Math.round(dose * ratio);

  const presets = [
    { label: '1:2', value: 2, note: 'Espresso' },
    { label: '1:6', value: 6, note: 'Cold Brew' },
    { label: '1:15', value: 15, note: 'Strong' },
    { label: '1:16', value: 16, note: 'Balanced' },
    { label: '1:17', value: 17, note: 'Light' },
  ];

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 16, marginBottom: 24 }}>
        <button className="btn btn-outline btn-sm" onClick={onBack}>← Back</button>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Ratio Calculator</h1>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 8 }}>
          Quick Presets
        </div>
        <div className="ratio-presets">
          {presets.map((p) => (
            <button
              key={p.value}
              className={`preset-btn ${ratio === p.value ? 'active' : ''}`}
              onClick={() => setRatio(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="calc-field">
        <label>Coffee Dose (g)</label>
        <input
          type="number"
          value={dose}
          onChange={(e) => setDose(Number(e.target.value) || 0)}
        />
      </div>

      <div className="calc-field">
        <label>Ratio (1 : X)</label>
        <input
          type="number"
          value={ratio}
          onChange={(e) => setRatio(Number(e.target.value) || 0)}
        />
      </div>

      <div className="card" style={{ background: 'var(--accent-bg)', border: '1.5px solid var(--accent)', textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          Water Needed
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 42, fontWeight: 700, color: 'var(--accent)' }}>
          {water}g
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          {dose}g coffee · 1:{ratio} ratio · {water}ml water
        </div>
      </div>
    </div>
  );
}

function ExtractionCompass({ onBack }) {
  const [selected, setSelected] = useState(null);
  const result = selected ? EXTRACTION_COMPASS[selected] : null;

  const options = [
    { key: 'sour', emoji: '🍋', label: 'Sour / Acidic' },
    { key: 'bitter', emoji: '😖', label: 'Bitter / Harsh' },
    { key: 'watery', emoji: '💧', label: 'Weak / Watery' },
    { key: 'astringent', emoji: '😬', label: 'Astringent / Dry' },
    { key: 'balanced', emoji: '✅', label: 'Balanced' },
    { key: 'sweet', emoji: '🍯', label: 'Sweet / Perfect' },
  ];

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 16, marginBottom: 24 }}>
        <button className="btn btn-outline btn-sm" onClick={onBack}>← Back</button>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Extraction Compass</h1>
      </div>

      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
        How did your coffee taste? Select the closest description and get personalized brewing adjustments.
      </p>

      <div className="compass-grid">
        {options.map((o) => (
          <button
            key={o.key}
            className={`compass-btn ${selected === o.key ? 'selected' : ''}`}
            onClick={() => setSelected(o.key)}
          >
            <span className="compass-emoji">{o.emoji}</span>
            <span className="compass-label">{o.label}</span>
          </button>
        ))}
      </div>

      {result && (
        <div className="compass-result">
          <h4>{result.diagnosis}</h4>
          <ul>
            {result.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TempGuide({ onBack }) {
  const guides = [
    { method: 'Espresso', light: '92-94°C', medium: '90-93°C', dark: '88-91°C' },
    { method: 'Pour-Over', light: '95-97°C', medium: '92-95°C', dark: '88-92°C' },
    { method: 'AeroPress', light: '88-92°C', medium: '82-88°C', dark: '78-85°C' },
    { method: 'French Press', light: '96-98°C', medium: '93-96°C', dark: '90-93°C' },
    { method: 'Moka Pot', light: 'Pre-heat water', medium: 'Pre-heat water', dark: 'Pre-heat water' },
    { method: 'Cold Brew', light: '2-4°C', medium: '2-4°C', dark: '2-4°C' },
  ];

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 16, marginBottom: 24 }}>
        <button className="btn btn-outline btn-sm" onClick={onBack}>← Back</button>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Water Temp Guide</h1>
      </div>

      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
        Recommended water temperatures by brew method and roast level. Lighter roasts generally need hotter water for proper extraction.
      </p>

      {/* Table header */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', padding: '12px 14px', background: 'var(--bg-card)' }}>
          <span>Method</span>
          <span>Light</span>
          <span>Medium</span>
          <span>Dark</span>
        </div>
        {guides.map((g, i) => (
          <div key={g.method} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            fontSize: 13,
            padding: '12px 14px',
            borderTop: i > 0 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ fontWeight: 600 }}>{g.method}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{g.light}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{g.medium}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{g.dark}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Pro Tips</h3>
        <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: 18 }}>
          <li>Water straight off boil is ~96°C, not 100°C</li>
          <li>Pouring into a cold vessel drops temp ~2-3°C</li>
          <li>Preheat your brewer to maintain temperature</li>
          <li>A gooseneck kettle with temp control is ideal</li>
        </ul>
      </div>
    </div>
  );
}
