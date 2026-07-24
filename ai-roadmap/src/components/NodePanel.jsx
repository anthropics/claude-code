import { STATUS, FI } from "../constants.js";
import { F } from "./ui.jsx";

export default function NodePanel({ panel, categories, edges, nmap, onUpdate, onClose, onDelete, onDuplicate, onDelEdge }) {
  const cc = id => categories.find(c => c.id === id)?.color || "#64748b";
  const updNode = (f, v) => {
    if (!panel) return;
    onUpdate(b => ({ ...b, nodes: b.nodes.map(n => n.id === panel.id ? { ...n, [f]: v } : n) }));
  };

  return (
    <div style={{
      position: "absolute", left: 0, top: 0, bottom: 0, width: 310,
      background: "#0a0e18", borderRight: "1px solid #0f1520",
      display: "flex", flexDirection: "column", zIndex: 20,
      boxShadow: "4px 0 24px rgba(0,0,0,.5)",
    }}>
      {/* Header */}
      <div style={{
        padding: "11px 13px 9px", borderBottom: "1px solid #0f1520",
        background: cc(panel.cat) + "0e",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: 2, background: cc(panel.cat) }} />
          <span style={{ fontSize: 8, fontWeight: 700, color: cc(panel.cat), letterSpacing: ".1em" }}>NODE EDITOR</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#1e2a3a", fontSize: 13, padding: 2, cursor: "pointer" }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 13, display: "flex", flexDirection: "column", gap: 11 }}>
        <F label="Title">
          <input
            value={panel.title}
            onChange={e => updNode("title", e.target.value)}
            style={{ ...FI, width: "100%" }}
          />
        </F>

        <div style={{ display: "flex", gap: 7 }}>
          <F label="Category" s={{ flex: 1 }}>
            <select value={panel.cat} onChange={e => updNode("cat", e.target.value)} style={{ ...FI, width: "100%" }}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </F>
          <F label="Rank" s={{ width: 60 }}>
            <input
              type="number" min={1} max={10} value={panel.rank}
              onChange={e => updNode("rank", Number(e.target.value))}
              style={{ ...FI, width: "100%" }}
            />
          </F>
        </div>

        <F label="Status">
          <div style={{ display: "flex", gap: 5 }}>
            {Object.entries(STATUS).map(([k, v]) => (
              <button
                key={k}
                onClick={() => updNode("status", k)}
                style={{
                  flex: 1, padding: "4px 0", borderRadius: 4, border: "1px solid", cursor: "pointer",
                  borderColor: panel.status === k ? v.dot : "#111927",
                  background: panel.status === k ? v.dot + "1e" : "transparent",
                  color: panel.status === k ? v.dot : "#1e2a3a",
                  fontSize: 8, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace",
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </F>

        <F label="URL">
          <div style={{ display: "flex", gap: 5 }}>
            <input
              value={panel.url}
              onChange={e => updNode("url", e.target.value)}
              style={{ ...FI, flex: 1 }}
              placeholder="https://"
            />
            {panel.url && (
              <a href={panel.url} target="_blank" rel="noreferrer"
                style={{
                  padding: "6px 8px", background: "#080c12", border: "1px solid #111927",
                  borderRadius: 5, color: "#334155", fontSize: 10, textDecoration: "none",
                }}>
                ↗
              </a>
            )}
          </div>
        </F>

        <F label="Notes / Build Task">
          <textarea
            value={panel.notes}
            onChange={e => updNode("notes", e.target.value)}
            rows={9}
            style={{ ...FI, width: "100%", resize: "vertical", minHeight: 160, lineHeight: 1.6 }}
          />
        </F>

        <F label="Connections">
          {(() => {
            const conns = edges.filter(e => e.from === panel.id || e.to === panel.id);
            if (!conns.length) return <div style={{ color: "#111927", fontSize: 9 }}>No connections</div>;
            return conns.map(e => {
              const oId = e.from === panel.id ? e.to : e.from;
              const other = nmap[oId];
              return (
                <div key={e.id} style={{
                  display: "flex", alignItems: "center", gap: 6, marginBottom: 4,
                  padding: "5px 7px", background: "#080c12", borderRadius: 5, border: "1px solid #0f1520",
                }}>
                  <span style={{ color: "#1e2a3a", fontSize: 9 }}>{e.from === panel.id ? "→" : "←"}</span>
                  <span style={{
                    flex: 1, color: "#334155", fontSize: 9,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {other?.title || oId}
                  </span>
                  <button
                    onClick={() => onDelEdge(e.id)}
                    style={{ background: "none", border: "none", color: "#1e2a3a", fontSize: 10, padding: "1px 3px", cursor: "pointer" }}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              );
            });
          })()}
        </F>

        <div style={{ display: "flex", gap: 7 }}>
          <button
            onClick={() => onDuplicate(panel.id)}
            style={{
              flex: 1, padding: "6px", border: "1px solid #111927",
              borderRadius: 5, background: "transparent", color: "#334155", fontSize: 9, cursor: "pointer",
              fontFamily: "'IBM Plex Mono',monospace",
            }}
          >
            ⧉ Duplicate
          </button>
          <button
            onClick={() => onDelete(panel.id)}
            style={{
              flex: 1, padding: "6px", border: "1px solid #7f1d1d35",
              borderRadius: 5, background: "#7f1d1d0d", color: "#ef4444", fontSize: 9, cursor: "pointer",
              fontFamily: "'IBM Plex Mono',monospace",
            }}
          >
            ✕ Delete
          </button>
        </div>
      </div>
    </div>
  );
}
