import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { NODE_W, NODE_H, uid, STATUS } from "./constants.js";
import { edgeGeom, rectsOverlap } from "./utils.js";
import Toolbar from "./components/Toolbar.jsx";
import NodePanel from "./components/NodePanel.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Minimap from "./components/Minimap.jsx";
import { AddNodeModal, EditGroupModal } from "./components/Modals.jsx";
import { CMI } from "./components/ui.jsx";

export default function Canvas({ board, onUpdate, onBack }) {
  const [zoom, setZoom] = useState(board.zoom || 0.55);
  const [pan, setPan] = useState(board.pan || { x: 40, y: 40 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(null);
  const [dragNode, setDragNode] = useState(null);
  const [dragGroup, setDragGroup] = useState(null);
  const [selectBox, setSelectBox] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [dragMulti, setDragMulti] = useState(null);
  const [panel, setPanel] = useState(null);
  const [mode, setMode] = useState("select");
  const [connecting, setConnecting] = useState(null);
  const [hovEdge, setHovEdge] = useState(null);
  const [editingEdge, setEditingEdge] = useState(null);
  const [edgeLabelVal, setEdgeLabelVal] = useState("");
  const [search, setSearch] = useState("");
  const [sidebar, setSidebar] = useState(false);
  const [groupMode, setGroupMode] = useState(false);
  const [groupDraw, setGroupDraw] = useState(null);
  const [editGroup, setEditGroup] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addPos, setAddPos] = useState(null);
  const [newN, setNewN] = useState({ title: "", cat: "", rank: 1, url: "", notes: "", status: "none" });

  const svgRef = useRef(null);
  const panRef = useRef(pan); panRef.current = pan;
  const zoomRef = useRef(zoom); zoomRef.current = zoom;

  const { nodes, edges, categories, groups } = board;
  const nmap = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);
  const cmap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories]);
  const cc = id => cmap[id]?.color || "#64748b";

  // Persist pan/zoom to board
  useEffect(() => { onUpdate(b => ({ ...b, pan, zoom })); }, [pan, zoom]);

  // Keyboard shortcuts
  useEffect(() => {
    const kd = e => {
      if (e.target.matches("input,textarea,select")) return;
      if (e.code === "Space") { e.preventDefault(); setSpaceHeld(true); }
      if (e.code === "Escape") { setCtx(null); setConnecting(null); setSelectBox(null); setGroupMode(false); setGroupDraw(null); }
      if ((e.code === "Delete" || e.code === "Backspace") && selected.size > 0 && !panel) {
        selected.forEach(id => delNode(id));
        setSelected(new Set());
      }
    };
    const ku = e => { if (e.code === "Space") setSpaceHeld(false); };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [selected, panel]);

  // Close context menu on outside click
  useEffect(() => {
    const h = () => setCtx(null);
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, []);

  // Scroll-to-zoom
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const h = e => {
      e.preventDefault();
      setZoom(z => Math.max(0.12, Math.min(3, z * (e.deltaY < 0 ? 1.1 : 0.91))));
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);

  const toC = useCallback((ex, ey) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: (ex - r.left - panRef.current.x) / zoomRef.current,
      y: (ey - r.top - panRef.current.y) / zoomRef.current,
    };
  }, []);

  const onSvgDown = e => {
    if (e.button !== 0) return;
    const cv = toC(e.clientX, e.clientY);
    if (groupMode) { setGroupDraw({ sx: cv.x, sy: cv.y, ex: cv.x, ey: cv.y }); return; }
    if (e.target === svgRef.current || e.target.classList.contains("cbg")) {
      setSelected(new Set()); setPanel(null); setConnecting(null);
      if (spaceHeld) {
        setPanning({ ox: e.clientX - panRef.current.x, oy: e.clientY - panRef.current.y });
      } else {
        setSelectBox({ sx: cv.x, sy: cv.y, ex: cv.x, ey: cv.y });
      }
    }
  };

  const onSvgMove = useCallback(e => {
    const cv = toC(e.clientX, e.clientY);
    if (groupDraw) { setGroupDraw(p => ({ ...p, ex: cv.x, ey: cv.y })); return; }
    if (panning) { setPan({ x: e.clientX - panning.ox, y: e.clientY - panning.oy }); return; }
    if (dragMulti) {
      const dx = cv.x - dragMulti.sx, dy = cv.y - dragMulti.sy;
      onUpdate(b => ({
        ...b,
        nodes: b.nodes.map(n => dragMulti.no[n.id] ? { ...n, x: dragMulti.no[n.id].x + dx, y: dragMulti.no[n.id].y + dy } : n),
        groups: b.groups.map(g => dragMulti.go[g.id] ? { ...g, x: dragMulti.go[g.id].x + dx, y: dragMulti.go[g.id].y + dy } : g),
      }));
      return;
    }
    if (dragNode) {
      const nx = cv.x - dragNode.ox, ny = cv.y - dragNode.oy;
      onUpdate(b => ({ ...b, nodes: b.nodes.map(n => n.id === dragNode.id ? { ...n, x: nx, y: ny } : n) }));
      if (panel?.id === dragNode.id) setPanel(p => p ? { ...p, x: nx, y: ny } : p);
      return;
    }
    if (dragGroup) {
      onUpdate(b => ({ ...b, groups: b.groups.map(g => g.id === dragGroup.id ? { ...g, x: cv.x - dragGroup.ox, y: cv.y - dragGroup.oy } : g) }));
      return;
    }
    if (selectBox) setSelectBox(p => ({ ...p, ex: cv.x, ey: cv.y }));
  }, [panning, dragNode, dragGroup, dragMulti, selectBox, groupDraw, panel, toC, onUpdate]);

  const onSvgUp = useCallback(e => {
    if (groupDraw) {
      const x = Math.min(groupDraw.sx, groupDraw.ex), y = Math.min(groupDraw.sy, groupDraw.ey);
      const w = Math.abs(groupDraw.ex - groupDraw.sx), h = Math.abs(groupDraw.ey - groupDraw.sy);
      if (w > 50 && h > 40) {
        const g = { id: uid(), x, y, w, h, label: "Group", color: "#818cf8" };
        onUpdate(b => ({ ...b, groups: [...b.groups, g] }));
        setEditGroup({ ...g });
      }
      setGroupDraw(null); setGroupMode(false);
      return;
    }
    if (selectBox) {
      const x1 = Math.min(selectBox.sx, selectBox.ex), x2 = Math.max(selectBox.sx, selectBox.ex);
      const y1 = Math.min(selectBox.sy, selectBox.ey), y2 = Math.max(selectBox.sy, selectBox.ey);
      if (x2 - x1 > 5 && y2 - y1 > 5) {
        const hit = nodes.filter(n => rectsOverlap(n.x, n.y, NODE_W, NODE_H, x1, y1, x2 - x1, y2 - y1));
        setSelected(new Set(hit.map(n => n.id)));
      }
      setSelectBox(null);
    }
    setDragNode(null); setDragGroup(null); setDragMulti(null); setPanning(null);
  }, [selectBox, groupDraw, nodes, onUpdate]);

  const onNodeDown = (e, id) => {
    e.stopPropagation();
    if (e.button === 2) return;
    if (mode === "delete") { delNode(id); return; }
    if (mode === "connect") {
      if (!connecting) setConnecting(id);
      else if (connecting !== id) { addEdge(connecting, id); setConnecting(null); }
      return;
    }
    if (spaceHeld) { setPanning({ ox: e.clientX - panRef.current.x, oy: e.clientY - panRef.current.y }); return; }
    const cv = toC(e.clientX, e.clientY), n = nmap[id]; if (!n) return;
    if (e.shiftKey) {
      setSelected(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
      return;
    }
    if (selected.has(id) && selected.size > 1) {
      const no = {}, go = {};
      selected.forEach(sid => { if (nmap[sid]) no[sid] = { x: nmap[sid].x, y: nmap[sid].y }; });
      setDragMulti({ sx: cv.x, sy: cv.y, no, go });
    } else {
      setSelected(new Set([id]));
      setPanel({ ...n });
      setDragNode({ id, ox: cv.x - n.x, oy: cv.y - n.y });
    }
  };

  const onGroupDown = (e, id) => {
    e.stopPropagation();
    if (e.button === 2) return;
    if (spaceHeld) { setPanning({ ox: e.clientX - panRef.current.x, oy: e.clientY - panRef.current.y }); return; }
    const cv = toC(e.clientX, e.clientY);
    const g = groups.find(x => x.id === id); if (!g) return;
    setDragGroup({ id, ox: cv.x - g.x, oy: cv.y - g.y });
  };

  // Board mutations
  const addEdge = (from, to) => {
    if (edges.find(e => e.from === from && e.to === to)) return;
    onUpdate(b => ({ ...b, edges: [...b.edges, { id: uid(), from, to, label: "" }] }));
  };
  const delEdge = id => onUpdate(b => ({ ...b, edges: b.edges.filter(e => e.id !== id) }));
  const delNode = id => {
    onUpdate(b => ({ ...b, nodes: b.nodes.filter(n => n.id !== id), edges: b.edges.filter(e => e.from !== id && e.to !== id) }));
    if (panel?.id === id) setPanel(null);
    setSelected(p => { const s = new Set(p); s.delete(id); return s; });
  };
  const delGroup = id => onUpdate(b => ({ ...b, groups: b.groups.filter(g => g.id !== id) }));
  const dupNode = id => {
    const n = nmap[id]; if (!n) return;
    onUpdate(b => ({ ...b, nodes: [...b.nodes, { ...n, id: uid(), x: n.x + 28, y: n.y + 28 }] }));
  };
  const disconnAll = id => onUpdate(b => ({ ...b, edges: b.edges.filter(e => e.from !== id && e.to !== id) }));

  const addNode = () => {
    if (!newN.title.trim()) return;
    const pos = addPos || { x: (-pan.x + 300) / zoom, y: (-pan.y + 200) / zoom };
    onUpdate(b => ({ ...b, nodes: [...b.nodes, { id: uid(), x: pos.x, y: pos.y, ...newN }] }));
    setShowAdd(false);
    setNewN({ title: "", cat: categories[0]?.id || "", rank: 1, url: "", notes: "", status: "none" });
    setAddPos(null);
  };

  const fitScreen = () => {
    if (!nodes.length || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const minX = Math.min(...nodes.map(n => n.x)) - 60;
    const minY = Math.min(...nodes.map(n => n.y)) - 60;
    const maxX = Math.max(...nodes.map(n => n.x + NODE_W)) + 60;
    const maxY = Math.max(...nodes.map(n => n.y + NODE_H)) + 60;
    const nz = Math.max(0.12, Math.min(1.5, Math.min(r.width / (maxX - minX), r.height / (maxY - minY)) * 0.9));
    setZoom(nz);
    setPan({ x: (r.width - (maxX - minX) * nz) / 2 - minX * nz, y: (r.height - (maxY - minY) * nz) / 2 - minY * nz });
  };

  const sl = search.toLowerCase();
  const match = n => !sl || n.title.toLowerCase().includes(sl) || n.notes.toLowerCase().includes(sl);
  const cur = spaceHeld ? (panning ? "grabbing" : "grab") : groupMode ? "crosshair" : mode === "connect" ? "crosshair" : mode === "delete" ? "not-allowed" : "default";

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#080c12", display: "flex", flexDirection: "column", fontFamily: "'IBM Plex Mono',monospace", overflow: "hidden" }}>
      <Toolbar
        boardName={board.name}
        mode={mode} setMode={setMode}
        setConnecting={setConnecting}
        categories={categories}
        onAddNode={() => { setNewN({ title: "", cat: categories[0]?.id || "", rank: 1, url: "", notes: "", status: "none" }); setShowAdd(true); }}
        groupMode={groupMode} setGroupMode={setGroupMode}
        search={search} setSearch={setSearch}
        zoom={zoom} setZoom={setZoom}
        setPan={setPan}
        fitScreen={fitScreen}
        onBack={onBack}
      />

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <svg
          ref={svgRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: cur, touchAction: "none" }}
          onPointerDown={onSvgDown}
          onPointerMove={onSvgMove}
          onPointerUp={onSvgUp}
          onPointerLeave={onSvgUp}
          onContextMenu={e => {
            e.preventDefault();
            const cv = toC(e.clientX, e.clientY);
            setCtx({ x: e.clientX, y: e.clientY, type: "canvas", cx: cv.x, cy: cv.y });
          }}
        >
          <defs>
            <pattern id="g" width="28" height="28" patternUnits="userSpaceOnUse"
              patternTransform={`translate(${((pan.x % 28) + 28) % 28},${((pan.y % 28) + 28) % 28})`}>
              <circle cx="1" cy="1" r="1.1" fill="#ffffff06" />
            </pattern>
            <marker id="ar" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="#2a3a52" />
            </marker>
            <marker id="arh" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
            </marker>
          </defs>
          <rect width="100%" height="100%" fill="url(#g)" className="cbg" />

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* Groups */}
            {groups.map(g => (
              <g key={g.id}
                onPointerDown={e => onGroupDown(e, g.id)}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, type: "group", id: g.id }); }}
                onDoubleClick={() => setEditGroup({ ...g })}
                style={{ cursor: spaceHeld ? "grab" : "move" }}
              >
                <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={10} fill={g.color + "0b"} stroke={g.color} strokeWidth="1.5" strokeDasharray="7 4" />
                <rect x={g.x} y={g.y} width={Math.max(60, g.label.length * 8 + 20)} height={22} rx={10} fill={g.color + "1e"} />
                <text x={g.x + 10} y={g.y + 15} fill={g.color} fontSize="11" fontWeight="700" fontFamily="'IBM Plex Mono',monospace">{g.label}</text>
              </g>
            ))}

            {/* Group draw preview */}
            {groupDraw && (
              <rect
                x={Math.min(groupDraw.sx, groupDraw.ex)} y={Math.min(groupDraw.sy, groupDraw.ey)}
                width={Math.abs(groupDraw.ex - groupDraw.sx)} height={Math.abs(groupDraw.ey - groupDraw.sy)}
                rx={10} fill="#fbbf2408" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="6 4"
              />
            )}

            {/* Edges */}
            {edges.map(en => {
              const a = nmap[en.from], b2 = nmap[en.to]; if (!a || !b2) return null;
              const { d, mx, my } = edgeGeom(a.x + NODE_W / 2, a.y + NODE_H / 2, b2.x + NODE_W / 2, b2.y + NODE_H / 2);
              const col = cc(a.cat), isH = hovEdge === en.id;
              return (
                <g key={en.id} onMouseEnter={() => setHovEdge(en.id)} onMouseLeave={() => setHovEdge(null)}>
                  {/* Wide invisible hit area */}
                  <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(16, 16 / zoom)}
                    onClick={() => mode === "delete" && delEdge(en.id)}
                    style={{ cursor: mode === "delete" ? "not-allowed" : "default" }}
                  />
                  <path d={d} fill="none" stroke={col} strokeWidth={isH ? 2.5 : 1.8}
                    strokeOpacity={isH ? 0.9 : 0.4} markerEnd={isH ? "url(#arh)" : "url(#ar)"}
                  />
                  {en.label && (
                    <text x={mx} y={my - 8} textAnchor="middle" fill={col} fontSize="9" fontFamily="'IBM Plex Mono',monospace" opacity=".8">
                      {en.label}
                    </text>
                  )}
                  {isH && mode !== "delete" && (
                    <g style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); delEdge(en.id); }}>
                      <circle cx={mx} cy={my} r={10} fill="#080c12" stroke={col} strokeWidth="1.5" />
                      <text x={mx} y={my + 4} textAnchor="middle" fill={col} fontSize="11" fontWeight="700">✕</text>
                    </g>
                  )}
                  {isH && !en.label && mode === "select" && (
                    <g style={{ cursor: "text" }} onDoubleClick={e => { e.stopPropagation(); setEditingEdge(en.id); setEdgeLabelVal(""); }}>
                      <circle cx={mx} cy={my} r={10} fill="#080c12" stroke={col} strokeWidth="1" strokeOpacity=".35" />
                      <text x={mx} y={my + 4} textAnchor="middle" fill={col} fontSize="10" opacity=".4">+</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Selection box */}
            {selectBox && (
              <rect
                x={Math.min(selectBox.sx, selectBox.ex)} y={Math.min(selectBox.sy, selectBox.ey)}
                width={Math.abs(selectBox.ex - selectBox.sx)} height={Math.abs(selectBox.ey - selectBox.sy)}
                fill="#818cf80a" stroke="#818cf8" strokeWidth="1.5" strokeDasharray="5 3" rx={3}
              />
            )}

            {/* Nodes */}
            {nodes.map(node => {
              const col = cc(node.cat), isSel = selected.has(node.id), isPan = panel?.id === node.id;
              const isConn = connecting === node.id, dim = search && !match(node);
              const sc = STATUS[node.status || "none"];
              return (
                <g key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  onPointerDown={e => onNodeDown(e, node.id)}
                  onDoubleClick={() => { setSelected(new Set([node.id])); setPanel({ ...nmap[node.id] }); }}
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, type: "node", id: node.id }); }}
                  style={{
                    cursor: spaceHeld ? "grab" : mode === "select" ? "grab" : mode === "delete" ? "not-allowed" : "crosshair",
                    opacity: dim ? 0.15 : 1,
                  }}
                >
                  {/* Shadow */}
                  <rect x={2} y={3} width={NODE_W} height={NODE_H} rx={8} fill="rgba(0,0,0,.4)" />
                  {/* Body */}
                  <rect width={NODE_W} height={NODE_H} rx={8}
                    fill={isSel || isPan ? "#141e2e" : "#0d1420"}
                    stroke={isSel || isPan || isConn ? col : "#141e2e"}
                    strokeWidth={isSel || isPan || isConn ? 2 : 1.5}
                  />
                  {/* Left accent bar */}
                  <rect x={0} y={0} width={5} height={NODE_H} rx={3} fill={col} />
                  <rect x={0} y={3} width={5} height={NODE_H - 6} fill={col} />
                  {/* Status dot */}
                  {node.status && node.status !== "none" && (
                    <circle cx={NODE_W - 11} cy={11} r={4.5} fill={sc.dot} />
                  )}
                  {/* Rank badge */}
                  <rect x={NODE_W - 34} y={node.status && node.status !== "none" ? 20 : 7} width={26} height={15} rx={4} fill={col + "1e"} />
                  <text x={NODE_W - 21} y={node.status && node.status !== "none" ? 30 : 17}
                    textAnchor="middle" fill={col} fontSize="9" fontWeight="700" fontFamily="'IBM Plex Mono',monospace">
                    R{node.rank}
                  </text>
                  {/* Title */}
                  <foreignObject x={12} y={9} width={NODE_W - 50} height={38}>
                    <div xmlns="http://www.w3.org/1999/xhtml" style={{
                      color: "#94a3b8", fontSize: 10.5, fontWeight: 600, lineHeight: "1.35",
                      fontFamily: "'IBM Plex Sans',sans-serif", overflow: "hidden",
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>
                      {node.title}
                    </div>
                  </foreignObject>
                  {/* Category label */}
                  <text x={12} y={NODE_H - 10} fill={col} fontSize="7.5" fontFamily="'IBM Plex Mono',monospace" fontWeight="700" opacity=".7">
                    {(cmap[node.cat]?.label || "").toUpperCase()}
                  </text>
                  {/* URL dot */}
                  {node.url && <circle cx={NODE_W - 10} cy={NODE_H - 12} r={3} fill={col + "80"} />}
                  {/* Connecting ring */}
                  {isConn && (
                    <rect x={-4} y={-4} width={NODE_W + 8} height={NODE_H + 8} rx={12}
                      fill="none" stroke={col} strokeWidth="2" strokeDasharray="8 4" />
                  )}
                  {/* Multi-select ring */}
                  {isSel && selected.size > 1 && (
                    <rect x={-3} y={-3} width={NODE_W + 6} height={NODE_H + 6} rx={11}
                      fill="none" stroke="#818cf8" strokeWidth="1.5" strokeDasharray="5 3" />
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Sidebar */}
        <Sidebar
          open={sidebar}
          onToggle={() => setSidebar(o => !o)}
          categories={categories}
          onUpdate={onUpdate}
        />

        {/* Node editor panel */}
        {panel && (
          <NodePanel
            panel={panel}
            categories={categories}
            edges={edges}
            nmap={nmap}
            onUpdate={fn => {
              onUpdate(fn);
              // Keep the panel state in sync by reflecting the updated node
              setPanel(prev => {
                if (!prev) return prev;
                const updated = fn(board).nodes.find(n => n.id === prev.id);
                return updated ? { ...updated } : prev;
              });
            }}
            onClose={() => { setPanel(null); setSelected(new Set()); }}
            onDelete={delNode}
            onDuplicate={dupNode}
            onDelEdge={delEdge}
          />
        )}

        {/* Minimap */}
        <Minimap
          nodes={nodes}
          edges={edges}
          pan={pan}
          zoom={zoom}
          svgRef={svgRef}
          ccFn={cc}
          sidebarOpen={sidebar}
        />

        {/* Status bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 26,
          background: "#0a0e18", borderTop: "1px solid #0f1520",
          display: "flex", alignItems: "center", padding: "0 12px", gap: 14, zIndex: 15,
        }}>
          <span style={{ color: "#111927", fontSize: 9 }}>{nodes.length} nodes · {edges.length} connections</span>
          {selected.size > 1 && <span style={{ color: "#818cf8", fontSize: 9 }}>{selected.size} selected · Delete key to remove</span>}
          <span style={{ color: "#0f1826", fontSize: 9 }}>
            {mode === "connect" && connecting
              ? `Connecting from "${nmap[connecting]?.title?.slice(0, 28)}…" → click target`
              : mode === "connect" ? "Click source node → click target to draw arrow"
              : mode === "delete" ? "Click node or arrow to delete"
              : groupMode ? "Draw a rectangle to create a group frame"
              : search ? `Showing matches for "${search}"`
              : "Hold Space + drag to pan · Scroll to zoom · Right-click for more options"}
          </span>
        </div>

        {/* Context menu */}
        {ctx && (
          <div
            style={{
              position: "fixed", left: ctx.x, top: ctx.y,
              background: "#0a0e18", border: "1px solid #111927", borderRadius: 8,
              padding: 5, zIndex: 100, minWidth: 175, boxShadow: "0 8px 32px rgba(0,0,0,.7)",
            }}
            onClick={e => e.stopPropagation()}
          >
            {ctx.type === "node" && [
              { i: "✎", l: "Edit",            f: () => { setSelected(new Set([ctx.id])); setPanel({ ...nmap[ctx.id] }); } },
              { i: "⧉", l: "Duplicate",       f: () => dupNode(ctx.id) },
              { i: "→", l: "Connect from here", f: () => { setMode("connect"); setConnecting(ctx.id); } },
              { i: "⊘", l: "Disconnect all",  f: () => disconnAll(ctx.id), d: true },
              { i: "✕", l: "Delete node",     f: () => delNode(ctx.id), d: true },
            ].map(it => <CMI key={it.l} icon={it.i} label={it.l} danger={it.d} onClick={() => { it.f(); setCtx(null); }} />)}

            {ctx.type === "canvas" && [
              { i: "+", l: "Add node here", f: () => { setAddPos({ x: ctx.cx, y: ctx.cy }); setNewN({ title: "", cat: categories[0]?.id || "", rank: 1, url: "", notes: "", status: "none" }); setShowAdd(true); } },
              { i: "⊞", l: "Fit all nodes", f: fitScreen },
              { i: "⌂", l: "Reset view",    f: () => { setZoom(0.55); setPan({ x: 40, y: 40 }); } },
            ].map(it => <CMI key={it.l} icon={it.i} label={it.l} onClick={() => { it.f(); setCtx(null); }} />)}

            {ctx.type === "group" && [
              { i: "✎", l: "Edit group",   f: () => { const g = groups.find(x => x.id === ctx.id); setEditGroup({ ...g }); } },
              { i: "✕", l: "Delete group", f: () => delGroup(ctx.id), d: true },
            ].map(it => <CMI key={it.l} icon={it.i} label={it.l} danger={it.d} onClick={() => { it.f(); setCtx(null); }} />)}
          </div>
        )}

        {/* Edge label input */}
        {editingEdge && (() => {
          const en = edges.find(e => e.id === editingEdge);
          const a = en && nmap[en.from], b2 = en && nmap[en.to]; if (!a || !b2) return null;
          const { mx, my } = edgeGeom(a.x + NODE_W / 2, a.y + NODE_H / 2, b2.x + NODE_W / 2, b2.y + NODE_H / 2);
          return (
            <div style={{ position: "absolute", left: mx * zoom + pan.x - 65, top: my * zoom + pan.y - 15, zIndex: 50 }}>
              <input
                autoFocus
                value={edgeLabelVal}
                onChange={e => setEdgeLabelVal(e.target.value)}
                onBlur={() => {
                  onUpdate(b => ({ ...b, edges: b.edges.map(e => e.id === editingEdge ? { ...e, label: edgeLabelVal } : e) }));
                  setEditingEdge(null);
                }}
                onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") e.target.blur(); }}
                style={{
                  width: 130, padding: "4px 8px", background: "#0a0e18", border: "1px solid #818cf8",
                  borderRadius: 5, color: "#e2e8f0", fontSize: 10, textAlign: "center",
                  fontFamily: "'IBM Plex Mono',monospace", outline: "none",
                }}
                placeholder="Label…"
              />
            </div>
          );
        })()}

        {/* Modals */}
        {showAdd && (
          <AddNodeModal
            categories={categories}
            newN={newN}
            setNewN={setNewN}
            onAdd={addNode}
            onClose={() => setShowAdd(false)}
          />
        )}
        <EditGroupModal
          editGroup={editGroup}
          setEditGroup={setEditGroup}
          onSave={() => {
            onUpdate(b => ({ ...b, groups: b.groups.map(g => g.id === editGroup.id ? { ...editGroup } : g) }));
            setEditGroup(null);
          }}
        />
      </div>
    </div>
  );
}
