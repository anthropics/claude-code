export const NODE_W = 210;
export const NODE_H = 76;

let _uid = 500;
export const uid = () => `id${++_uid}`;

export function initUidFrom(boards) {
  // Ensure uid counter stays above any numeric IDs already saved
  boards.forEach(b => {
    [...(b.nodes || []), ...(b.edges || []), ...(b.groups || [])].forEach(item => {
      const m = String(item.id).match(/^id(\d+)$/);
      if (m) _uid = Math.max(_uid, Number(m[1]));
    });
    _uid = Math.max(_uid, Number(String(b.id).match(/^id(\d+)$/)?.[1] || 0));
  });
}

export const COLOR_PRESETS = [
  "#22d3a5","#60a5fa","#a78bfa","#fbbf24","#fb923c",
  "#2dd4bf","#38bdf8","#818cf8","#f472b6","#34d399",
  "#f87171","#e879f9","#facc15","#4ade80","#fb7185",
];

export const STATUS = {
  none:       { label: "—",           dot: "#1e2a3a" },
  todo:       { label: "To Watch",    dot: "#64748b" },
  inprogress: { label: "In Progress", dot: "#0ea5e9" },
  done:       { label: "Done",        dot: "#22c55e" },
};

// Shared inline style tokens
export const FI = {
  padding: "6px 8px",
  border: "1px solid #111927",
  borderRadius: 5,
  fontSize: 10,
  color: "#64748b",
  background: "#080c12",
  fontFamily: "'IBM Plex Mono',monospace",
};

export const TB = {
  width: 24, height: 24,
  borderRadius: 4,
  border: "1px solid #111927",
  background: "transparent",
  color: "#334155",
  fontSize: 13,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
