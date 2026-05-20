import { useState } from "react";
import { NODE_W, NODE_H } from "../constants.js";

export default function Minimap({ nodes, edges, pan, zoom, svgRef, ccFn, sidebarOpen }) {
  const [open, setOpen] = useState(true);
  const MW = 155, MH = 96;

  const mmB = (() => {
    if (!nodes.length) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    return {
      minX: Math.min(...nodes.map(n => n.x)) - 50,
      minY: Math.min(...nodes.map(n => n.y)) - 50,
      maxX: Math.max(...nodes.map(n => n.x + NODE_W)) + 50,
      maxY: Math.max(...nodes.map(n => n.y + NODE_H)) + 50,
    };
  })();

  const bw = mmB.maxX - mmB.minX || 1;
  const bh = mmB.maxY - mmB.minY || 1;
  const sc = Math.min(MW / bw, MH / bh) * 0.88;
  const ox = (MW - bw * sc) / 2;
  const oy = (MH - bh * sc) / 2;
  const toM = (x, y) => ({ x: (x - mmB.minX) * sc + ox, y: (y - mmB.minY) * sc + oy });

  const sr = svgRef.current?.getBoundingClientRect();
  const vpW = sr ? sr.width / zoom : 800;
  const vpH = sr ? sr.height / zoom : 600;
  const vp = toM(-pan.x / zoom, -pan.y / zoom);

  return (
    <div style={{
      position: "absolute", bottom: 34, right: sidebarOpen ? 294 : 10,
      zIndex: 18, transition: "right .2s",
    }}>
      <div style={{ background: "#0a0e18", border: "1px solid #0f1520", borderRadius: 7, overflow: "hidden" }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: "100%", padding: "4px 9px", background: "transparent", border: "none",
            borderBottom: open ? "1px solid #0f1520" : "none",
            color: "#1e2a3a", fontSize: 8, fontWeight: 700, letterSpacing: 1,
            textAlign: "left", display: "flex", justifyContent: "space-between", cursor: "pointer",
            fontFamily: "'IBM Plex Mono',monospace",
          }}
        >
          <span>MINIMAP</span>
          <span>{open ? "▼" : "▲"}</span>
        </button>
        {open && (
          <svg width={MW} height={MH} style={{ display: "block" }}>
            <rect width={MW} height={MH} fill="#080c12" />
            {nodes.map(n => {
              const p = toM(n.x, n.y);
              return (
                <rect
                  key={n.id} x={p.x} y={p.y}
                  width={NODE_W * sc} height={NODE_H * sc}
                  rx={1} fill={ccFn(n.cat)} opacity={0.55}
                />
              );
            })}
            <rect
              x={vp.x} y={vp.y} width={vpW * sc} height={vpH * sc}
              fill="none" stroke="#818cf8" strokeWidth="1.5" opacity=".65" rx={2}
            />
          </svg>
        )}
      </div>
    </div>
  );
}
