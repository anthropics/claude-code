import { useState } from "react";
import { NODE_W, NODE_H } from "../constants.js";

export default function BoardCard({ board, onOpen, onRename, onDuplicate, onExport, onDelete }) {
  const [hovering, setHovering] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(board.name);

  const fmt = ts => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const commitRename = () => {
    onRename(renameVal);
    setRenaming(false);
  };

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => !renaming && onOpen()}
      style={{
        background: "#0d1117",
        border: `1px solid ${hovering ? "#2a3a52" : "#111927"}`,
        borderRadius: 11, overflow: "hidden", cursor: "pointer", position: "relative",
        transform: hovering ? "translateY(-2px)" : "none",
        transition: "transform .15s, border-color .15s",
      }}
    >
      {/* Preview thumbnail */}
      <div style={{ height: 130, background: "#080c12", position: "relative", overflow: "hidden" }}>
        <svg width="100%" height="100%" style={{ opacity: 0.45 }}>
          <pattern id={`dp${board.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#1a2535" />
          </pattern>
          <rect width="100%" height="100%" fill={`url(#dp${board.id})`} />
          {board.nodes.slice(0, 24).map(n => {
            const sc = 0.12;
            const cat = board.categories.find(c => c.id === n.cat);
            return (
              <rect
                key={n.id}
                x={8 + n.x * sc} y={8 + n.y * sc}
                width={20} height={9} rx={2}
                fill={cat?.color || "#334155"} opacity={0.65}
              />
            );
          })}
        </svg>
      </div>

      {/* Info */}
      <div style={{ padding: "13px 15px 15px" }}>
        {renaming ? (
          <input
            autoFocus
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === "Enter") e.target.blur();
              if (e.key === "Escape") { setRenameVal(board.name); setRenaming(false); }
            }}
            onClick={e => e.stopPropagation()}
            style={{
              background: "#111927", border: "1px solid #2a3a52", borderRadius: 4,
              padding: "3px 7px", color: "#e2e8f0", fontSize: 13, fontWeight: 700, width: "100%",
              fontFamily: "'IBM Plex Mono',monospace", outline: "none",
            }}
          />
        ) : (
          <div style={{
            color: "#cbd5e1", fontSize: 13, fontWeight: 700, marginBottom: 3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {board.name}
          </div>
        )}
        <div style={{ color: "#1e2a3a", fontSize: 10, marginBottom: 11 }}>
          {board.nodes.length} nodes · {fmt(board.updatedAt)}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {board.categories.slice(0, 5).map(c => (
            <div key={c.id} style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "#080c12", padding: "2px 6px", borderRadius: 20,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: c.color }} />
              <span style={{ color: "#334155", fontSize: 9 }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons — appear on hover */}
      <div
        style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4, opacity: hovering ? 1 : 0, transition: "opacity .15s" }}
        onClick={e => e.stopPropagation()}
      >
        {[
          { i: "✎", t: "Rename",    f: () => { setRenaming(true); setRenameVal(board.name); } },
          { i: "⧉", t: "Duplicate", f: onDuplicate },
          { i: "↓", t: "Export",    f: onExport },
          { i: "✕", t: "Delete",    f: onDelete },
        ].map(a => (
          <button
            key={a.t}
            title={a.t}
            onClick={a.f}
            style={{
              width: 25, height: 25, borderRadius: 5, border: "1px solid #1e2a3a",
              background: "#0d1117ee", color: "#64748b", fontSize: 10,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            {a.i}
          </button>
        ))}
      </div>
    </div>
  );
}
