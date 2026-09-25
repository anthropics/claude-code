/* ---------- Analytics ----------
 * Advanced baseball analytics that recompute on every state update.
 * Pure functions; no side effects.
 */
(function (global) {
  "use strict";

  const PLAYS = global.SC.PLAYS;

  // --- Per-batter stat line -------------------------------------------------
  function playerLine(player) {
    let ab = 0, h = 0, bb = 0, k = 0, hbp = 0, tb = 0, r = 0, rbi = 0, sf = 0, pa = 0;
    let hits2 = 0, hits3 = 0, hitsHR = 0;
    for (const cell of player.atBats) {
      if (!cell) continue;
      const play = PLAYS[cell.play];
      if (!play) continue;
      pa++;
      if (play.ab) ab++;
      if (play.h) { h++; tb += play.bases; if (play.bases === 2) hits2++; if (play.bases === 3) hits3++; if (play.bases === 4) hitsHR++; }
      if (play.bb) bb++;
      if (play.k) k++;
      if (play.id === "HBP") hbp++;
      if (play.id === "SF") sf++;
      if (cell.runs) r += cell.runs;
      if (cell.rbi) rbi += cell.rbi;
    }
    const avg = ab > 0 ? h / ab : 0;
    const obpDen = ab + bb + hbp + sf;
    const obp = obpDen > 0 ? (h + bb + hbp) / obpDen : 0;
    const slg = ab > 0 ? tb / ab : 0;
    const ops = obp + slg;
    // BABIP: (H - HR) / (AB - K - HR + SF)
    const babipDen = ab - k - hitsHR + sf;
    const babip = babipDen > 0 ? (h - hitsHR) / babipDen : 0;
    const iso = slg - avg; // isolated power
    return { ab, h, bb, k, hbp, tb, r, rbi, sf, pa, avg, obp, slg, ops, babip, iso, d: hits2, t: hits3, hr: hitsHR };
  }

  function teamLines(team) {
    return team.players.map(playerLine);
  }

  function teamTotals(team) {
    const lines = teamLines(team);
    const T = { ab: 0, h: 0, bb: 0, k: 0, hbp: 0, tb: 0, r: 0, rbi: 0, sf: 0, pa: 0, d: 0, t: 0, hr: 0 };
    for (const L of lines) {
      for (const k of Object.keys(T)) T[k] += L[k] || 0;
    }
    T.avg = T.ab > 0 ? T.h / T.ab : 0;
    const obpDen = T.ab + T.bb + T.hbp + T.sf;
    T.obp = obpDen > 0 ? (T.h + T.bb + T.hbp) / obpDen : 0;
    T.slg = T.ab > 0 ? T.tb / T.ab : 0;
    T.ops = T.obp + T.slg;
    T.iso = T.slg - T.avg;
    const babipDen = T.ab - T.k - T.hr + T.sf;
    T.babip = babipDen > 0 ? (T.h - T.hr) / babipDen : 0;
    T.risp = rispFor(team);
    T.twoOutRbi = twoOutRbi(team);
    T.lob = team.lob || 0;
    return T;
  }

  // RISP & two-out RBI require the log since at-bat cells don't track base state.
  // We compute RISP opportunities approximately from the log using basesBefore.
  function rispFor(team) {
    // Needs game log; fallback 0. Populated in gameAnalytics(game).
    return 0;
  }
  function twoOutRbi() { return 0; }

  // --- Pitcher metrics ------------------------------------------------------
  function pitcherLine(p) {
    const ip = p.ip; // stored as innings.outs-ish decimal
    const ipDec = Math.floor(ip) + (Math.round((ip - Math.floor(ip)) * 10) / 3 * (1 / 1));
    // Proper IP decimal: ip is already outs/3
    const innings = p.ip; // treat as numeric innings
    const whip = innings > 0 ? (p.bb + p.h) / innings : 0;
    const era = innings > 0 ? (p.er * 9) / innings : 0;
    const kPer9 = innings > 0 ? (p.k * 9) / innings : 0;
    const bbPer9 = innings > 0 ? (p.bb * 9) / innings : 0;
    const kbb = p.bb > 0 ? p.k / p.bb : p.k;
    const pitchesPerInning = innings > 0 ? p.pitches / innings : 0;
    return Object.assign({}, p, { whip, era, kPer9, bbPer9, kbb, pitchesPerInning });
  }

  // --- Game-level analytics, derived from log -------------------------------
  function gameAnalytics(game) {
    const home = teamTotals(game.home);
    const away = teamTotals(game.away);

    // RISP & two-out RBI from log
    const risp = { home: { ab: 0, h: 0, rbi: 0 }, away: { ab: 0, h: 0, rbi: 0 } };
    const twoOut = { home: 0, away: 0 };
    for (const e of game.log) {
      const bucket = e.side === "top" ? "away" : "home";
      const runnersRisp = (e.basesBefore && (e.basesBefore[1] || e.basesBefore[2])) ? true : false;
      const play = PLAYS[e.play];
      if (!play) continue;
      if (play.ab && runnersRisp) {
        risp[bucket].ab++;
        if (play.h) risp[bucket].h++;
        risp[bucket].rbi += e.rbi || 0;
      }
      // Two-out RBI: if outsAfter - (play.outs) >= 2 (i.e. before this play there were 2 outs) and RBIs came in
      const outsBefore = (e.outsAfter || 0) - (play.outs || 0);
      if (outsBefore >= 2 && e.rbi > 0) twoOut[bucket] += e.rbi;
    }
    home.rispAvg = risp.home.ab > 0 ? risp.home.h / risp.home.ab : 0;
    away.rispAvg = risp.away.ab > 0 ? risp.away.h / risp.away.ab : 0;
    home.rispAB = risp.home.ab; away.rispAB = risp.away.ab;
    home.rispH = risp.home.h;   away.rispH = risp.away.h;
    home.twoOutRbi = twoOut.home;
    away.twoOutRbi = twoOut.away;

    // Leverage / Win probability (simplified toy model).
    const wp = winProbability(game, home, away);

    // Run expectancy for current base-out state
    const re = runExpectancy(game.bases, game.outs);

    // Spray chart + pull/oppo splits
    const spray = sprayChartData(game);

    // Pitch mix summary
    const pitchEff = pitchEfficiency(game);

    return { home, away, wp, re, spray, pitchEff };
  }

  // --- Win probability ------------------------------------------------------
  // Coarse heuristic: base on current run diff, inning, half, bases, outs.
  function winProbability(game, homeT, awayT) {
    const homeRuns = sum(game.home.runsByInning);
    const awayRuns = sum(game.away.runsByInning);
    const diff = homeRuns - awayRuns;
    const inning = game.inning;
    const half = game.half;
    const outs = game.outs;
    const runnersOn = game.bases.filter(Boolean).length;

    // Remaining half-innings (9 inning game model)
    const halvesLeft = Math.max(0, (9 - inning) * 2 + (half === "top" ? 2 : 1)) - 1;

    // Base probability from run diff — logistic-like
    let hp = 0.5 + diff * 0.07;
    // Dampen as game gets longer
    hp -= (halvesLeft - 9) * 0.005;
    // Who's batting?
    const batting = half === "top" ? "away" : "home";
    // Baserunners favor batting team
    const runnerBoost = (runnersOn * 0.02) + (runnersOn >= 2 ? 0.015 : 0);
    const outPenalty = outs * 0.015;
    if (batting === "home") hp += runnerBoost - outPenalty;
    else hp -= runnerBoost - outPenalty;

    hp = Math.max(0.02, Math.min(0.98, hp));
    return { home: hp, away: 1 - hp, homeRuns, awayRuns, diff };
  }

  // --- Run expectancy (24-state toy matrix) ---------------------------------
  // Approx 2010s MLB RE24 values
  const RE24 = {
    "0_000": 0.481, "0_100": 0.859, "0_010": 1.100, "0_110": 1.437,
    "0_001": 1.350, "0_101": 1.784, "0_011": 1.964, "0_111": 2.292,
    "1_000": 0.254, "1_100": 0.509, "1_010": 0.664, "1_110": 0.884,
    "1_001": 0.950, "1_101": 1.130, "1_011": 1.376, "1_111": 1.541,
    "2_000": 0.098, "2_100": 0.224, "2_010": 0.319, "2_110": 0.429,
    "2_001": 0.353, "2_101": 0.478, "2_011": 0.580, "2_111": 0.752,
  };
  function runExpectancy(bases, outs) {
    const code = (outs >= 3 ? 2 : outs) + "_" + (bases[0] ? 1 : 0) + (bases[1] ? 1 : 0) + (bases[2] ? 1 : 0);
    return RE24[code] != null ? RE24[code] : 0;
  }

  // --- Spray chart ----------------------------------------------------------
  function sprayChartData(game) {
    const counts = {}; // zone -> { hits, outs }
    for (const loc of game.hitLocations) {
      if (!counts[loc.zone]) counts[loc.zone] = { hits: 0, outs: 0, play: loc.play };
      if (loc.isHit) counts[loc.zone].hits++;
      else counts[loc.zone].outs++;
    }
    // Pull/Center/Oppo split — assume RHH: pull = LF/3B/SS, center = CF/2B/P, oppo = RF/1B
    const pull = ["LF", "3B", "SS"];
    const center = ["CF", "2B", "P"];
    const oppo = ["RF", "1B"];
    let pullHits = 0, centerHits = 0, oppoHits = 0;
    let pullTot = 0, centerTot = 0, oppoTot = 0;
    for (const loc of game.hitLocations) {
      const bucket = pull.includes(loc.zone) ? "pull" : center.includes(loc.zone) ? "center" : "oppo";
      if (bucket === "pull") { pullTot++; if (loc.isHit) pullHits++; }
      if (bucket === "center") { centerTot++; if (loc.isHit) centerHits++; }
      if (bucket === "oppo") { oppoTot++; if (loc.isHit) oppoHits++; }
    }
    return {
      zones: counts,
      splits: {
        pull:   { hits: pullHits,   total: pullTot,   pct: pullTot ? pullHits / pullTot : 0 },
        center: { hits: centerHits, total: centerTot, pct: centerTot ? centerHits / centerTot : 0 },
        oppo:   { hits: oppoHits,   total: oppoTot,   pct: oppoTot ? oppoHits / oppoTot : 0 },
      },
    };
  }

  function pitchEfficiency(game) {
    const totalPitches = game.pitches || 0;
    const batters = game.log.filter((e) => PLAYS[e.play] && (PLAYS[e.play].kind === "BAT")).length;
    const pitchesPerPA = batters > 0 ? totalPitches / batters : 0;
    return { totalPitches, batters, pitchesPerPA };
  }

  // --- Helpers --------------------------------------------------------------
  function sum(arr) { return arr.reduce((a, b) => a + (b || 0), 0); }

  // Format a batting average / percentage to ".XYZ" style
  function fmtAvg(n) {
    if (!isFinite(n) || n <= 0) return ".000";
    // Keep leading "1." for values >= 1 so OPS/SLG aren't clamped.
    if (n >= 1) return n.toFixed(3);
    return n.toFixed(3).replace(/^0\./, ".");
  }
  function fmtPct(n) {
    if (!isFinite(n)) return "—";
    return Math.round(n * 100) + "%";
  }
  function fmtNum(n, d) {
    if (!isFinite(n)) return "—";
    return n.toFixed(d == null ? 2 : d);
  }
  function fmtIP(ip) {
    const whole = Math.floor(ip);
    const frac = Math.round((ip - whole) * 3);
    return whole + (frac > 0 ? "." + frac : ".0");
  }

  global.SC.analytics = {
    playerLine,
    teamLines,
    teamTotals,
    pitcherLine,
    gameAnalytics,
    winProbability,
    runExpectancy,
    sprayChartData,
    pitchEfficiency,
    fmtAvg, fmtPct, fmtNum, fmtIP,
  };
})(window);
