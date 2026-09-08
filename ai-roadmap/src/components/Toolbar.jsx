import { TB } from "../constants.js";

export default function Toolbar({
  boardName, mode, setMode, setConnecting,
  categories, onAddNode, groupMode, setGroupMode,
  search, setSearch,
  zoom, setZoom, setPan, fitScreen, onBack,
}) {
  return (
    <div style={{
      height: 46, background: "#0a0e18", borderBottom: "1px solid #0f1520",
      display: "flex", alignItems: "center", padding: "0 12px",
      gap: 7, flexShrink: 0, zIndex: 10,
    }}>
      <button
        onClick={onBack}
        style={{
          padding: "3px 9px", borderRadius: 5, border: "1px solid #111927",
          background: "transparent", color: "#334155", fontSize: 10,
          display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
        }}
      >
        ← Boards
      </button>

      <div style={{ width: 1, height: 18, background: "#111927" }} />

      <span style={{
        color: "#334155", fontSize: 11, fontWeight: 600,
        maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {boardName}
      </span>

      <div style={{ width: 1, height: 18, background: "#111927" }} />

      {[
        { id: "select",  icon: "↖", label: "Select"  },
        { id: "connect", icon: "→", label: "Connect" },
        { id: "delete",  icon: "✕", label: "Delete"  },
      ].map(m => (
        <button
          key={m.id}
          onClick={() => { setMode(m.id); setConnecting(null); }}
          style={{
            padding: "3px 10px", borderRadius: 5, border: "1px solid", cursor: "pointer",
            borderColor: mode === m.id ? "#818cf8" : "#111927",
            background: mode === m.id ? "#818cf812" : "transparent",
            color: mode === m.id ? "#818cf8" : "#334155",
            fontSize: 10,
          }}
        >
          {m.icon} {m.label}
        </button>
      ))}

      <div style={{ width: 1, height: 18, background: "#111927" }} />

      <button
        onClick={() => onAddNode()}
        style={{
          padding: "3px 10px", borderRadius: 5, border: "1px solid #22d3a530",
          background: "#22d3a510", color: "#22d3a5", fontSize: 10, cursor: "pointer",
        }}
      >
        + Node
      </button>

      <button
        onClick={() => setGroupMode(a => !a)}
        style={{
          padding: "3px 10px", borderRadius: 5, border: "1px solid", cursor: "pointer",
          borderColor: groupMode ? "#fbbf24" : "#111927",
          background: groupMode ? "#fbbf2412" : "transparent",
          color: groupMode ? "#fbbf24" : "#334155",
          fontSize: 10,
        }}
      >
        ▭ Group
      </button>

      <div style={{ flex: 1 }} />

      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <span style={{ position: "absolute", left: 7, color: "#1e2a3a", fontSize: 11, pointerEvents: "none" }}>⌕</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter…"
          style={{
            background: "#080c12", border: "1px solid #111927", borderRadius: 5,
            padding: "3px 24px 3px 22px", color: "#64748b", fontSize: 10, width: 130,
            fontFamily: "'IBM Plex Mono',monospace", outline: "none",
          }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{ position: "absolute", right: 5, background: "none", border: "none", color: "#334155", fontSize: 11, cursor: "pointer" }}
          >
            ✕
          </button>
        )}
      </div>

      <button onClick={fitScreen} title="Fit all nodes" style={{ ...TB, cursor: "pointer" }}>⊞</button>
      <button onClick={() => setZoom(z => Math.min(3, z * 1.15))} style={{ ...TB, cursor: "pointer" }}>+</button>
      <span style={{ color: "#1e2a3a", fontSize: 9, minWidth: 32, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
      <button onClick={() => setZoom(z => Math.max(0.12, z * 0.87))} style={{ ...TB, cursor: "pointer" }}>−</button>
      <button onClick={() => { setZoom(0.55); setPan({ x: 40, y: 40 }); }} title="Reset" style={{ ...TB, cursor: "pointer" }}>⌂</button>
    </div>
  );
}
