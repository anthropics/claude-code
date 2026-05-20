/* Quick smoke test for store + analytics (Node). */
const fakeWindow = {};
global.window = fakeWindow;
global.localStorage = {
  _s: {},
  getItem(k) { return this._s[k] || null; },
  setItem(k, v) { this._s[k] = String(v); },
};

require("./src/store.js");
require("./src/analytics.js");

const SC = fakeWindow.SC;

// Fresh game
let g = SC.freshGame();
console.log("Fresh game:", g.home.name, "vs", g.away.name);

// Record a few plays: leadoff HR, K, BB, 1B (scoring the walk)
g.activeAB = { side: "top", playerIdx: 0, inning: 1 };
g = SC.recordPlay(g, "HR", { pitches: 4, hitLocation: "CF" });
g = SC.recordPlay(g, "K", { pitches: 4 });
g = SC.recordPlay(g, "BB", { pitches: 5 });
g = SC.recordPlay(g, "1B", { pitches: 3, hitLocation: "RF" });
g = SC.recordPlay(g, "GO", { pitches: 3 });
g = SC.recordPlay(g, "FO", { pitches: 3 });

const A = SC.analytics;
const stats = A.gameAnalytics(g);
console.log("Away runs:", g.away.runsByInning);
console.log("Home runs:", g.home.runsByInning);
console.log("Away totals:", { ab: stats.away.ab, h: stats.away.h, bb: stats.away.bb, k: stats.away.k, avg: A.fmtAvg(stats.away.avg), obp: A.fmtAvg(stats.away.obp), slg: A.fmtAvg(stats.away.slg), ops: A.fmtAvg(stats.away.ops) });
console.log("Pitcher top:", A.pitcherLine(g.pitchers.top));
console.log("RE24:", stats.re);
console.log("Win prob:", stats.wp);
console.log("Spray splits:", stats.spray.splits);

// Check an edge case: 3 outs should flip sides
let g2 = SC.freshGame();
g2.activeAB = { side: "top", playerIdx: 0, inning: 1 };
g2 = SC.recordPlay(g2, "K", { pitches: 4 });
g2 = SC.recordPlay(g2, "K", { pitches: 4 });
g2 = SC.recordPlay(g2, "K", { pitches: 4 });
console.log("After 3 Ks — half:", g2.half, "outs:", g2.outs, "inning:", g2.inning);

// HR with bases loaded
let g3 = SC.freshGame();
g3.activeAB = { side: "bot", playerIdx: 0, inning: 1 };
g3 = SC.recordPlay(g3, "1B", { pitches: 3 });
g3 = SC.recordPlay(g3, "1B", { pitches: 3 });
g3 = SC.recordPlay(g3, "1B", { pitches: 3 });
g3 = SC.recordPlay(g3, "HR", { pitches: 4, hitLocation: "LF" });
console.log("Grand slam home runs by inning:", g3.home.runsByInning);
console.log("Bases after grand slam:", g3.bases);
