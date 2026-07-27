import { useState, useEffect, useRef, useCallback } from 'react';

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function BrewSession({ recipe, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef(null);

  const step = recipe.steps[currentStep];
  const stepDuration = step?.duration || 0;
  const stepProgress = Math.min(elapsed / stepDuration, 1);
  const circumference = 2 * Math.PI * 110;

  const advanceStep = useCallback(() => {
    if (currentStep < recipe.steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setElapsed(0);
    } else {
      setIsRunning(false);
      setFinished(true);
    }
  }, [currentStep, recipe.steps.length]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= stepDuration) {
            advanceStep();
            return 0;
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, stepDuration, advanceStep]);

  const toggleRunning = () => {
    if (finished) return;
    setIsRunning(!isRunning);
  };

  const skipStep = () => {
    if (finished) return;
    advanceStep();
  };

  const totalElapsed = recipe.steps.slice(0, currentStep).reduce((sum, s) => sum + s.duration, 0) + elapsed;

  if (finished) {
    return (
      <div className="brew-screen" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>☕</div>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Brew Complete!</h2>
        <p style={{ fontSize: 16, color: 'rgba(240,234,224,0.7)', marginBottom: 8 }}>{recipe.name}</p>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, color: 'var(--accent)', marginBottom: 40 }}>
          Total time: {formatTime(totalElapsed)}
        </p>
        <button className="btn btn-primary" onClick={onClose} style={{ padding: '16px 40px', fontSize: 16 }}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="brew-screen">
      <div className="brew-header">
        <button className="back-btn" onClick={onClose}>
          ✕ Exit
        </button>
        <span className="recipe-title">{recipe.name}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: 'var(--accent)' }}>
          {formatTime(totalElapsed)}
        </span>
      </div>

      {/* Step progress dots */}
      <div className="step-progress">
        {recipe.steps.map((_, i) => (
          <div
            key={i}
            className={`step-dot ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'done' : ''}`}
          />
        ))}
      </div>

      {/* Timer ring */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
        <svg width="260" height="260" viewBox="0 0 260 260">
          <circle className="timer-ring-bg" cx="130" cy="130" r="110" />
          <circle
            className="timer-ring timer-ring-progress"
            cx="130" cy="130" r="110"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - stepProgress)}
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
          />
          <text
            x="130" y="125"
            textAnchor="middle"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 52,
              fontWeight: 600,
              fill: '#F0EAE0',
            }}
          >
            {formatTime(stepDuration - elapsed)}
          </text>
          <text
            x="130" y="155"
            textAnchor="middle"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 14,
              fill: 'rgba(240,234,224,0.4)',
            }}
          >
            remaining
          </text>
        </svg>
      </div>

      {/* Current step info */}
      <div className="step-label">
        Step {currentStep + 1} of {recipe.steps.length} — {step.label}
      </div>
      <div className="step-instruction">{step.instruction}</div>

      {step.targetWeight && (
        <div className="target-weight">
          Target: {step.targetWeight}g
        </div>
      )}

      {/* Controls */}
      <div className="brew-controls">
        <button className="brew-btn" onClick={onClose} title="Exit">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
        </button>
        <button className="brew-btn primary" onClick={toggleRunning}>
          {isRunning ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          )}
        </button>
        <button className="brew-btn" onClick={skipStep} title="Next step">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 15,12 5,21" />
            <rect x="17" y="3" width="3" height="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
