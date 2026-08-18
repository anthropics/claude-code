/**
 * AI Learning Roadmap — Main Entry Point
 *
 * Features:
 *  - localStorage persistence: boards survive page refresh
 *  - Hash-based URL routing: #board-{id} opens a board directly
 *  - Multi-board manager home screen
 *  - Full interactive canvas (see Canvas.jsx)
 */

import { useState, useEffect } from "react";
import { uid, initUidFrom } from "./constants.js";
import { makeBoard } from "./utils.js";
import { DEFAULT_CATS } from "./data/seeds.js";
import { GB } from "./components/ui.jsx";
import BoardCard from "./components/BoardCard.jsx";
import Canvas from "./Canvas.jsx";

const STORAGE_KEY = "ai-roadmap-boards";

// ── localStorage helpers ──────────────────────────────────────────────────────

function loadBoards() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const boards = JSON.parse(raw);
    if (!Array.isArray(boards) || !boards.length) return null;
    // Hydrate missing fields that older saves may not have
    return boards.map(b => ({
      groups: [],
      ...b,
      categories: b.categories?.length ? b.categories : DEFAULT_CATS.map(c => ({ ...c })),
    }));
  } catch {
    return null;
  }
}

function saveBoards(boards) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
  } catch {
    // Storage quota exceeded — silently ignore
  }
}

// ── URL routing helpers ───────────────────────────────────────────────────────

function getBoardIdFromHash() {
  const hash = window.location.hash.slice(1);
  return hash.startsWith("board-") ? hash.slice(6) : null;
}

function setBoardHash(id) {
  window.location.hash = id ? `board-${id}` : "";
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [boards, setBoards] = useState(() => {
    const saved = loadBoards();
    if (saved) {
      initUidFrom(saved); // ensure uid counter is ahead of saved IDs
      return saved;
    }
    return [makeBoard("AI Learning Roadmap", true)];
  });

  const [activeId, setActiveId] = useState(() => getBoardIdFromHash());

  // Persist boards to localStorage on every change
  useEffect(() => {
    saveBoards(boards);
  }, [boards]);

  // Keep URL hash in sync with active board
  useEffect(() => {
    setBoardHash(activeId);
  }, [activeId]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handler = () => setActiveId(getBoardIdFromHash());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  // Board CRUD
  const upd = (id, fn) =>
    setBoards(p => p.map(b => b.id === id ? { ...fn(b), updatedAt: Date.now() } : b));

  const create = seed => {
    const b = makeBoard(seed ? "New Roadmap" : "Blank Board", seed);
    setBoards(p => [...p, b]);
    setActiveId(b.id);
  };

  const duplicate = id => {
    const src = boards.find(b => b.id === id); if (!src) return;
    const nb = { ...JSON.parse(JSON.stringify(src)), id: uid(), name: src.name + " (copy)", createdAt: Date.now(), updatedAt: Date.now() };
    setBoards(p => [...p, nb]);
  };

  const remove = id => {
    if (!window.confirm(`Delete "${boards.find(b => b.id === id)?.name}"?`)) return;
    setBoards(p => p.filter(b => b.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const rename = (id, name) =>
    setBoards(p => p.map(b => b.id === id ? { ...b, name, updatedAt: Date.now() } : b));

  const exportBoard = id => {
    const b = boards.find(b => b.id === id); if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }));
    a.download = `${b.name.replace(/\s+/g, "_")}.json`;
    a.click();
  };

  const importBoard = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          const nb = { ...data, id: uid(), name: data.name + " (imported)", updatedAt: Date.now() };
          setBoards(p => [...p, nb]);
          setActiveId(nb.id);
        } catch {
          alert("Invalid board file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // ── Canvas view ─────────────────────────────────────────────────────────────
  const active = boards.find(b => b.id === activeId);
  if (active) {
    return (
      <Canvas
        board={active}
        onUpdate={fn => upd(activeId, fn)}
        onBack={() => setActiveId(null)}
      />
    );
  }

  // ── Board manager home ───────────────────────────────────────────────────────
  const fmt = ts => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: "#080c12", fontFamily: "'IBM Plex Mono',monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button, input, select, textarea { font-family: inherit; outline: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #1e2a3a; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "28px 44px 0", borderBottom: "1px solid #0f1520" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 22 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7, background: "#22d3a520",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <rect x="0" y="0" width="6" height="6" rx="1.5" fill="#22d3a5" />
                  <rect x="8" y="0" width="6" height="6" rx="1.5" fill="#818cf8" />
                  <rect x="0" y="8" width="6" height="6" rx="1.5" fill="#f472b6" />
                  <rect x="8" y="8" width="6" height="6" rx="1.5" fill="#60a5fa" />
                </svg>
              </div>
              <span style={{ color: "#e2e8f0", fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>ROADMAP</span>
            </div>
            <p style={{ color: "#1e2a3a", fontSize: 11 }}>Your visual thinking workspace</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <GB onClick={importBoard}>↑ Import</GB>
            <GB onClick={() => create(false)}>+ Blank</GB>
            <GB primary onClick={() => create(true)}>+ From Template</GB>
          </div>
        </div>
      </div>

      {/* Board grid */}
      <div style={{
        padding: "28px 44px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 18,
      }}>
        {boards.map(b => (
          <BoardCard
            key={b.id}
            board={b}
            onOpen={() => setActiveId(b.id)}
            onRename={name => rename(b.id, name)}
            onDuplicate={() => duplicate(b.id)}
            onExport={() => exportBoard(b.id)}
            onDelete={() => remove(b.id)}
          />
        ))}

        {!boards.length && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "80px 0" }}>
            <div style={{ color: "#111927", fontSize: 36, marginBottom: 14 }}>◫</div>
            <div style={{ color: "#1e2a3a", fontSize: 13, marginBottom: 18 }}>No boards yet</div>
            <GB primary onClick={() => create(true)}>Create your first board</GB>
          </div>
        )}
      </div>
    </div>
  );
}
