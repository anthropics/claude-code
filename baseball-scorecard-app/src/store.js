/* ---------- Store ----------
 * Lightweight subscribe/dispatch store with reducer-style updates.
 * All scoring rules live here so the UI stays declarative.
 */
(function (global) {
  "use strict";

  // --- Play taxonomy --------------------------------------------------------
  // Each play has: id, label, kind, short (cell label), color category,
  // hit type (for SLG), counts as: AB?, H?, BB?, K?, RBI default, outs added,
  // and how it advances baserunners.
  const PLAYS = {
    "1B":   { id: "1B", label: "Single",        kind: "BAT", short: "1B", color: "hit",  bases: 1, ab: true,  h: true,  bb: false, k: false, outs: 0 },
    "2B":   { id: "2B", label: "Double",        kind: "BAT", short: "2B", color: "hit",  bases: 2, ab: true,  h: true,  bb: false, k: false, outs: 0 },
    "3B":   { id: "3B", label: "Triple",        kind: "BAT", short: "3B", color: "hit",  bases: 3, ab: true,  h: true,  bb: false, k: false, outs: 0 },
    "HR":   { id: "HR", label: "Home Run",      kind: "BAT", short: "HR", color: "hit",  bases: 4, ab: true,  h: true,  bb: false, k: false, outs: 0 },
    "BB":   { id: "BB", label: "Walk",          kind: "BAT", short: "BB", color: "bb",   bases: 1, ab: false, h: false, bb: true,  k: false, outs: 0 },
    "K":    { id: "K",  label: "Strike Out",    kind: "BAT", short: "K",  color: "k",    bases: 0, ab: true,  h: false, bb: false, k: true,  outs: 1 },
    "GO":   { id: "GO", label: "Groundout",     kind: "BAT", short: "GO", color: "out",  bases: 0, ab: true,  h: false, bb: false, k: false, outs: 1 },
    "FO":   { id: "FO", label: "Flyout",        kind: "BAT", short: "FO", color: "out",  bases: 0, ab: true,  h: false, bb: false, k: false, outs: 1 },
    "LO":   { id: "LO", label: "Lineout",       kind: "BAT", short: "LO", color: "out",  bases: 0, ab: true,  h: false, bb: false, k: false, outs: 1 },
    "PO":   { id: "PO", label: "Pop Out",       kind: "BAT", short: "PO", color: "out",  bases: 0, ab: true,  h: false, bb: false, k: false, outs: 1 },
    "SF":   { id: "SF", label: "Sacrifice",     kind: "BAT", short: "SF", color: "out",  bases: 0, ab: false, h: false, bb: false, k: false, outs: 1, rbiDefault: 1 },
    "E":    { id: "E",  label: "Error",         kind: "BAT", short: "E",  color: "out",  bases: 1, ab: true,  h: false, bb: false, k: false, outs: 0 },
    "HBP":  { id: "HBP",label: "Hit by Pitch",  kind: "BAT", short: "HP", color: "bb",   bases: 1, ab: false, h: false, bb: false, k: false, outs: 0 },
    "FC":   { id: "FC", label: "Fielders Choice",kind:"BAT", short: "FC", color: "out",  bases: 1, ab: true,  h: false, bb: false, k: false, outs: 1 },
    "FOR":  { id: "FOR",label: "Force Out",     kind: "BAT", short: "FO", color: "out",  bases: 0, ab: true,  h: false, bb: false, k: false, outs: 1 },
    "SB":   { id: "SB", label: "Stolen Base",   kind: "OTH", short: "SB", color: "hit",  bases: 0, ab: false, h: false, bb: false, k: false, outs: 0 },
  };

  const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
  const FIELD_ZONES = ["1B", "2B", "3B", "SS", "LF", "CF", "RF"];

  // --- Demo data -------------------------------------------------------------
  function demoPlayers(prefix) {
    const wildcats = [
      { name: "J. Smith",    pos: "SS" },
      { name: "M. Johnson",  pos: "2B" },
      { name: "A. Williams", pos: "CF" },
      { name: "T. Brown",    pos: "1B" },
      { name: "D. Jones",    pos: "RF" },
      { name: "C. Miller",   pos: "3B" },
      { name: "B. Davis",    pos: "LF" },
      { name: "L. Garcia",   pos: "C"  },
      { name: "K. Martinez", pos: "P"  },
    ];
    const eagles = [
      { name: "R. Lee",      pos: "CF" },
      { name: "P. Adams",    pos: "SS" },
      { name: "S. Patel",    pos: "1B" },
      { name: "G. Nguyen",   pos: "C"  },
      { name: "H. Carter",   pos: "LF" },
      { name: "F. Walker",   pos: "3B" },
      { name: "Q. Reed",     pos: "RF" },
      { name: "V. Cole",     pos: "2B" },
      { name: "N. Bell",     pos: "P"  },
    ];
    return (prefix === "WIL" ? wildcats : eagles).map((p) => ({
      ...p,
      atBats: Array(11).fill(null).map(() => null),
    }));
  }

  function freshGame() {
    const home = {
      id: "WIL", name: "Wildcats", abbrev: "WIL", logo: "paw",
      players: demoPlayers("WIL"),
      runsByInning: Array(11).fill(null),
      lob: 0,
    };
    const away = {
      id: "EAG", name: "Eagles", abbrev: "EAG", logo: "eagle",
      players: demoPlayers("EAG"),
      runsByInning: Array(11).fill(null),
      lob: 0,
    };
    return {
      id: "g1",
      home,
      away,
      inning: 1,
      half: "top", // "top" = away batting, "bot" = home batting
      outs: 0,
      balls: 0,
      strikes: 0,
      pitches: 0,
      bases: [null, null, null], // 1B, 2B, 3B occupant idx
      battingIdx: { top: 0, bot: 0 }, // current batter index per side
      activeAB: { side: "top", playerIdx: 0, inning: 1 }, // selected scorecard cell
      pitchers: {
        top: { outs: 0, ip: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, pitches: 0, name: "K. Martinez" }, // home pitcher facing away
        bot: { outs: 0, ip: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, pitches: 0, name: "N. Bell" },
      },
      log: [], // chronological play log for analytics
      hitLocations: [], // {side, playerIdx, inning, zone, type}
    };
  }

  // --- Reducer ---------------------------------------------------------------
  function recordPlay(game, playId, opts) {
    opts = opts || {};
    const play = PLAYS[playId];
    if (!play) return game;

    // Deep clone the parts of state we mutate. Atbats are nested.
    const g = JSON.parse(JSON.stringify(game));
    const sideKey = g.activeAB.side;
    const battingTeam = sideKey === "top" ? g.away : g.home;
    const fieldingTeam = sideKey === "top" ? g.home : g.away;
    const pitcher = g.pitchers[sideKey];
    const playerIdx = g.activeAB.playerIdx;
    const inningIdx = g.activeAB.inning - 1;
    const player = battingTeam.players[playerIdx];

    // Resolve runners advancement and runs scored
    const before = g.bases.slice();
    let runs = 0;
    let bases = before.slice();

    // Note: base occupants are player indices (can be 0), so we compare to null explicitly.
    const occ = (v) => v != null;
    if (play.id === "HR") {
      runs += 1 + bases.filter(occ).length;
      bases = [null, null, null];
    } else if (play.bases > 0) {
      // advance existing runners by play.bases
      const adv = play.bases;
      const newBases = [null, null, null];
      for (let i = 2; i >= 0; i--) {
        if (occ(bases[i])) {
          const newPos = i + adv;
          if (newPos >= 3) runs++;
          else newBases[newPos] = bases[i];
        }
      }
      const batterPos = adv - 1;
      if (batterPos < 3) newBases[batterPos] = playerIdx;
      else runs++;
      bases = newBases;
    } else if (play.id === "SF") {
      // Sacrifice fly: runner from 3rd scores
      if (occ(bases[2])) { runs++; bases[2] = null; }
    } else if (play.id === "FC" || play.id === "FOR") {
      // Replace lead runner with batter; assume runner forced at 2nd
      bases[0] = playerIdx;
    }

    const rbi = opts.rbi != null ? opts.rbi : (play.rbiDefault != null ? play.rbiDefault : runs);

    // Record at-bat cell
    const cell = {
      play: play.id,
      short: play.short,
      color: play.color,
      bases: play.bases,
      rbi: rbi,
      pitches: opts.pitches || 0,
      runs: runs,
      hitLocation: opts.hitLocation || null,
      ts: Date.now(),
    };
    player.atBats[inningIdx] = cell;

    // Update outs
    const outsAdded = play.outs;
    g.outs += outsAdded;

    // Update pitcher
    pitcher.pitches += opts.pitches || 0;
    g.pitches += opts.pitches || 0;
    if (play.h) pitcher.h++;
    if (play.bb) pitcher.bb++;
    if (play.k) pitcher.k++;
    pitcher.r += runs;
    pitcher.er += runs; // simple model: all earned
    pitcher.outs = (pitcher.outs || 0) + outsAdded;
    pitcher.ip = pitcher.outs / 3;

    // Update team line
    if (runs > 0) {
      battingTeam.runsByInning[inningIdx] =
        (battingTeam.runsByInning[inningIdx] || 0) + runs;
    } else if (battingTeam.runsByInning[inningIdx] == null) {
      battingTeam.runsByInning[inningIdx] = 0;
    }

    // Reset count, push log
    g.balls = 0;
    g.strikes = 0;
    g.bases = bases;

    g.log.push({
      side: sideKey,
      inning: g.activeAB.inning,
      playerIdx,
      playerName: player.name,
      play: play.id,
      runs,
      rbi,
      hitLocation: opts.hitLocation || null,
      basesBefore: before,
      basesAfter: bases.slice(),
      outsAfter: g.outs,
      ts: Date.now(),
    });

    if (opts.hitLocation) {
      g.hitLocations.push({
        side: sideKey,
        playerIdx,
        inning: g.activeAB.inning,
        zone: opts.hitLocation,
        play: play.id,
        isHit: !!play.h,
      });
    }

    // Advance batter
    const nextIdx = (playerIdx + 1) % battingTeam.players.length;
    g.battingIdx[sideKey] = nextIdx;

    // Half-inning over?
    if (g.outs >= 3) {
      // Strand any baserunners (player indices can be 0, check explicitly)
      battingTeam.lob += g.bases.filter((v) => v != null).length;
      g.bases = [null, null, null];
      g.outs = 0;
      if (sideKey === "top") {
        g.half = "bot";
        g.activeAB = { side: "bot", playerIdx: g.battingIdx.bot, inning: g.inning };
      } else {
        g.half = "top";
        g.inning += 1;
        g.activeAB = { side: "top", playerIdx: g.battingIdx.top, inning: g.inning };
      }
    } else {
      g.activeAB = {
        side: sideKey,
        playerIdx: nextIdx,
        inning: g.activeAB.inning,
      };
    }

    return g;
  }

  function setActiveCell(game, side, playerIdx, inning) {
    return Object.assign({}, game, {
      activeAB: { side, playerIdx, inning },
    });
  }

  function pitch(game, kind) {
    // kind: "ball" | "strike" | "foul"
    const g = JSON.parse(JSON.stringify(game));
    g.pitches++;
    g.pitchers[g.activeAB.side].pitches++;
    if (kind === "ball") {
      g.balls = Math.min(4, g.balls + 1);
      if (g.balls >= 4) return recordPlay(g, "BB", { pitches: 0 });
    } else if (kind === "strike") {
      g.strikes = Math.min(3, g.strikes + 1);
      if (g.strikes >= 3) return recordPlay(g, "K", { pitches: 0 });
    } else if (kind === "foul") {
      if (g.strikes < 2) g.strikes++;
    }
    return g;
  }

  // --- Store ----------------------------------------------------------------
  const STORAGE_KEY = "scorecard.v1";

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    // Pre-populate with the demo state from the mockups (Wildcats 3 - Eagles 1, Top 4th)
    return seededDemo();
  }

  function seededDemo() {
    let g = freshGame();
    // The mockups show Wildcats (home) 3, Eagles (away) 1, Top 4th, 1 out, 56 pitches.
    // Replay just enough plays to mirror that. We cheat by directly setting at-bats.
    const wildcats = g.home;
    const eagles = g.away;

    // Inning 1 - Eagles 1 run via leadoff HR
    eagles.players[0].atBats[0] = { play: "HR", short: "HR", color: "hit", bases: 4, rbi: 1, runs: 1, hitLocation: "CF" };
    eagles.runsByInning[0] = 1;
    // Inning 1 - Wildcats no runs - K8 leadoff strikeout shown as F8 in mockup actually
    wildcats.players[0].atBats[0] = { play: "FO", short: "F8", color: "out", bases: 0, rbi: 0, runs: 0, hitLocation: "CF" };
    wildcats.runsByInning[0] = 0;

    // Inning 2 - Wildcats - 2 runs via BB + 1B
    wildcats.players[1].atBats[1] = { play: "BB", short: "BB", color: "bb", bases: 1, rbi: 0, runs: 0 };
    wildcats.players[1].atBats[2] = { play: "1B", short: "1B", color: "hit", bases: 1, rbi: 1, runs: 1, hitLocation: "RF" };
    wildcats.runsByInning[1] = 0;
    wildcats.runsByInning[2] = 1;

    // Inning 4 (top) - Eagles - 1 out, batter 3 grounded out
    eagles.players[2].atBats[3] = null; // active cell
    eagles.runsByInning[3] = 0;

    g.inning = 4;
    g.half = "top";
    g.outs = 1;
    g.balls = 2;
    g.strikes = 1;
    g.pitches = 56;
    g.pitchers.top = { ip: 3, h: 4, r: 1, er: 1, bb: 1, k: 2, pitches: 56, name: "K. Martinez" };
    g.pitchers.bot = { ip: 3, h: 2, r: 3, er: 3, bb: 2, k: 1, pitches: 48, name: "N. Bell" };
    g.battingIdx.top = 2;
    g.activeAB = { side: "top", playerIdx: 2, inning: 4 };
    g.log = [
      { side: "top", inning: 1, playerIdx: 0, playerName: "R. Lee", play: "HR", runs: 1, rbi: 1, hitLocation: "CF" },
      { side: "bot", inning: 1, playerIdx: 0, playerName: "J. Smith", play: "FO", runs: 0, rbi: 0, hitLocation: "CF" },
      { side: "bot", inning: 2, playerIdx: 1, playerName: "M. Johnson", play: "BB", runs: 0, rbi: 0 },
      { side: "bot", inning: 3, playerIdx: 1, playerName: "M. Johnson", play: "1B", runs: 1, rbi: 1, hitLocation: "RF" },
    ];
    g.hitLocations = [
      { side: "top", playerIdx: 0, inning: 1, zone: "CF", play: "HR", isHit: true },
      { side: "bot", playerIdx: 0, inning: 1, zone: "CF", play: "FO", isHit: false },
      { side: "bot", playerIdx: 1, inning: 3, zone: "RF", play: "1B", isHit: true },
    ];
    return g;
  }

  function save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function createStore() {
    let state = {
      tab: "scorecard",
      sheet: null, // { type, ... }
      toast: null,
      game: load(),
    };
    const subs = new Set();
    function emit() { for (const fn of subs) fn(state); save(state.game); }
    return {
      get: () => state,
      set: (patch) => { state = Object.assign({}, state, patch); emit(); },
      patchGame: (mut) => {
        const next = typeof mut === "function" ? mut(state.game) : mut;
        state = Object.assign({}, state, { game: next });
        emit();
      },
      subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
      reset: () => { state = Object.assign({}, state, { game: freshGame() }); emit(); },
      seedDemo: () => { state = Object.assign({}, state, { game: seededDemo() }); emit(); },
      toast: (msg) => {
        state = Object.assign({}, state, { toast: { msg, ts: Date.now() } });
        emit();
        setTimeout(() => {
          state = Object.assign({}, state, { toast: null });
          emit();
        }, 1600);
      },
    };
  }

  global.SC = global.SC || {};
  global.SC.PLAYS = PLAYS;
  global.SC.POSITIONS = POSITIONS;
  global.SC.FIELD_ZONES = FIELD_ZONES;
  global.SC.recordPlay = recordPlay;
  global.SC.setActiveCell = setActiveCell;
  global.SC.pitch = pitch;
  global.SC.createStore = createStore;
  global.SC.freshGame = freshGame;
})(window);
