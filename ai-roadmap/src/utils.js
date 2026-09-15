import { uid } from "./constants.js";
import { DEFAULT_CATS, SEED_NODES, SEED_EDGES } from "./data/seeds.js";
import { NODE_H, NODE_W } from "./constants.js";

export function edgeGeom(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len, uy = dy / len, pad = NODE_H / 2 + 5;
  const sx = ax + ux * pad, sy = ay + uy * pad;
  const ex = bx - ux * pad, ey = by - uy * pad;
  const cpx = (sx + ex) / 2 - uy * 50;
  const cpy = (sy + ey) / 2 + ux * 50;
  const mx = 0.25 * sx + 0.5 * cpx + 0.25 * ex;
  const my = 0.25 * sy + 0.5 * cpy + 0.25 * ey;
  return { d: `M${sx},${sy} Q${cpx},${cpy} ${ex},${ey}`, mx, my };
}

export function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function makeBoard(name, seed = false) {
  return {
    id: uid(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    nodes:      seed ? SEED_NODES.map(n => ({ ...n })) : [],
    edges:      seed ? SEED_EDGES.map(e => ({ ...e })) : [],
    categories: DEFAULT_CATS.map(c => ({ ...c })),
    groups:     [],
    pan:        { x: 40, y: 40 },
    zoom:       0.55,
  };
}
