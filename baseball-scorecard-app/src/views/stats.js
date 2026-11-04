/* Advanced analytics view — updates live with scorecard. */
(function (global) {
  "use strict";
  const A = global.SC.analytics;
  const I = global.SC.icons;

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) {
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return el;
  }

  function render(state, store) {
    const g = state.game;
    const stats = A.gameAnalytics(g);
    const view = h("div", null);

    view.appendChild(h("div", { class: "appbar" },
      h("button", { class: "icon-btn", onClick: () => store.set({ tab: "scorecard" }), html: I.back }),
      h("div", { class: "title" }, "Advanced Analytics"),
      h("button", { class: "icon-btn", html: I.more }),
    ));

    // Which team focus
    const side = (state.statsTeam) || "home";
    view.appendChild(h("div", { class: "sheet-tabs", style: "margin:10px 0 4px;" },
      tabBtn(g.home.name, side === "home", () => store.set({ statsTeam: "home" })),
      tabBtn(g.away.name, side === "away", () => store.set({ statsTeam: "away" })),
    ));

    const tt = side === "home" ? stats.home : stats.away;
    const pt = side === "home" ? A.pitcherLine(g.pitchers.bot) : A.pitcherLine(g.pitchers.top);

    // --- Win probability -------------------------------------------------
    view.appendChild(h("div", { class: "stats-section" },
      h("div", { class: "stats-title" }, "Win Probability"),
      h("div", { class: "win-prob" },
        h("div", { class: "team-prob" },
          h("div", { class: "name" }, g.home.name),
          h("div", { class: "pct" }, Math.round(stats.wp.home * 100) + "%"),
        ),
        h("div", { class: "team-prob", style: "text-align:right;" },
          h("div", { class: "name" }, g.away.name),
          h("div", { class: "pct" }, Math.round(stats.wp.away * 100) + "%"),
        ),
        h("div", { class: "wp-bar", style: "grid-column: 1 / -1;" },
          h("div", { class: "home-fill", style: "width:" + (stats.wp.home * 100) + "%;" }),
          h("div", { class: "away-fill", style: "width:" + (stats.wp.away * 100) + "%;" }),
        ),
      ),
    ));

    // --- Core batting KPIs -----------------------------------------------
    view.appendChild(h("div", { class: "stats-section" },
      h("div", { class: "stats-title" }, "Team Batting — Live"),
      h("div", { class: "kpi-grid" },
        kpi("AVG", A.fmtAvg(tt.avg),  tt.h + " for " + tt.ab),
        kpi("OBP", A.fmtAvg(tt.obp),  "On-base %"),
        kpi("SLG", A.fmtAvg(tt.slg),  tt.tb + " TB"),
        kpi("OPS", A.fmtAvg(tt.ops),  "OBP + SLG"),
        kpi("ISO", A.fmtAvg(tt.iso),  "Raw power"),
        kpi("BABIP", A.fmtAvg(tt.babip), "Balls in play"),
      ),
    ));

    // --- Situational ------------------------------------------------------
    view.appendChild(h("div", { class: "stats-section" },
      h("div", { class: "stats-title" }, "Situational"),
      h("div", { class: "kpi-grid" },
        kpi("RISP", A.fmtAvg(tt.rispAvg),     tt.rispH + " for " + tt.rispAB),
        kpi("2-Out RBI", String(tt.twoOutRbi), "This game"),
        kpi("LOB", String(tt.lob),             "Stranded"),
      ),
    ));

    // --- Pitching --------------------------------------------------------
    view.appendChild(h("div", { class: "stats-section" },
      h("div", { class: "stats-title" }, "Pitching — " + pt.name),
      h("div", { class: "kpi-grid" },
        kpi("IP",   A.fmtIP(pt.ip),       ""),
        kpi("ERA",  A.fmtNum(pt.era, 2),  pt.er + " ER"),
        kpi("WHIP", A.fmtNum(pt.whip, 2), "(H+BB)/IP"),
        kpi("K/9",  A.fmtNum(pt.kPer9, 1),pt.k + " K"),
        kpi("BB/9", A.fmtNum(pt.bbPer9, 1), pt.bb + " BB"),
        kpi("P/IP", A.fmtNum(pt.pitchesPerInning, 1), pt.pitches + " P"),
      ),
    ));

    // --- Run expectancy --------------------------------------------------
    view.appendChild(h("div", { class: "stats-section" },
      h("div", { class: "stats-title" }, "Run Expectancy — Current State"),
      h("div", { class: "kpi-grid" },
        kpi("RE24", A.fmtNum(stats.re, 3), outsLabel(g.outs) + " \u00B7 " + basesLabel(g.bases)),
        kpi("Leverage", leverageTag(stats.wp), "vs. game context"),
        kpi("P/PA", A.fmtNum(stats.pitchEff.pitchesPerPA, 2), stats.pitchEff.batters + " PA"),
      ),
    ));

    // --- Spray splits ----------------------------------------------------
    const sp = stats.spray.splits;
    view.appendChild(h("div", { class: "stats-section" },
      h("div", { class: "stats-title" }, "Spray Chart"),
      buildSprayCard(stats.spray),
      h("div", { class: "bar-list", style: "margin-top:10px;" },
        barRow("Pull",   sp.pull.hits,   sp.pull.total),
        barRow("Center", sp.center.hits, sp.center.total),
        barRow("Oppo",   sp.oppo.hits,   sp.oppo.total),
      ),
    ));

    // --- Batter leaders --------------------------------------------------
    view.appendChild(h("div", { class: "stats-section" },
      h("div", { class: "stats-title" }, "Top Hitters"),
      buildLeaders(side === "home" ? g.home : g.away),
    ));

    return view;
  }

  function kpi(label, value, sub) {
    return h("div", { class: "kpi-card" },
      h("div", { class: "label" }, label),
      h("div", { class: "value" }, value),
      sub ? h("div", { class: "sub" }, sub) : null,
    );
  }
  function tabBtn(label, active, onClick) {
    const b = h("button", { onClick }, label);
    if (active) b.classList.add("active");
    return b;
  }
  function outsLabel(o) { return o + " " + (o === 1 ? "out" : "outs"); }
  function basesLabel(b) {
    const on = b.map((v, i) => v ? ["1B","2B","3B"][i] : null).filter(Boolean);
    if (on.length === 0) return "bases empty";
    return on.join(", ");
  }
  function leverageTag(wp) {
    const swing = Math.abs(wp.home - 0.5);
    if (swing > 0.35) return "Low";
    if (swing < 0.1) return "High";
    return "Medium";
  }

  function barRow(label, num, den) {
    const pct = den > 0 ? num / den : 0;
    return h("div", { class: "bar-item" },
      h("div", { class: "label" }, label),
      h("div", { class: "bar-track" },
        h("div", { class: "bar-fill", style: "width:" + (pct * 100) + "%;" }),
      ),
      h("div", { class: "v" }, num + "/" + den),
    );
  }

  function buildSprayCard(spray) {
    const card = h("div", { class: "spray-card" });
    // Zone dot overlay on a mini-field
    const zones = {
      LF: [90, 80], CF: [200, 55], RF: [310, 80],
      SS: [160, 140], "2B": [240, 140], "3B": [130, 175], "1B": [270, 175], P: [200, 190],
    };
    let dots = "";
    for (const z of Object.keys(spray.zones)) {
      const pos = zones[z];
      if (!pos) continue;
      const info = spray.zones[z];
      const total = info.hits + info.outs;
      const r = 5 + total * 2.5;
      const fill = info.hits > info.outs ? "#4a7a3a" : "#b94a3a";
      dots += `<circle cx="${pos[0]}" cy="${pos[1]}" r="${r}" fill="${fill}" fill-opacity="0.55" stroke="${fill}" stroke-width="1"/>
               <text x="${pos[0]}" y="${pos[1] + 3}" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">${info.hits}/${info.hits + info.outs}</text>`;
    }
    card.innerHTML = `
      <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid meet">
        <path d="M 40 190 A 180 180 0 0 1 360 190 Z" fill="#eef3e3" stroke="#bcd3a6"/>
        <path d="M 200 205 L 120 135 L 200 75 L 280 135 Z" fill="#f3e2cd" stroke="#c7a887"/>
        <line x1="200" y1="205" x2="40" y2="45"  stroke="#cfdcc1" stroke-width="1"/>
        <line x1="200" y1="205" x2="360" y2="45" stroke="#cfdcc1" stroke-width="1"/>
        ${dots}
      </svg>
    `;
    return card;
  }

  function buildLeaders(team) {
    const lines = team.players.map((p, i) => Object.assign({ i, name: p.name, pos: p.pos }, A.playerLine(p)))
      .filter((l) => l.pa > 0)
      .sort((a, b) => b.ops - a.ops)
      .slice(0, 4);
    if (!lines.length) return h("div", { class: "empty" }, h("div", { class: "b" }, "No at-bats yet."));
    const list = h("div", null);
    lines.forEach((l) => {
      list.appendChild(h("div", { class: "lineup-row", style: "grid-template-columns: 1fr 60px 60px 50px;" },
        h("div", null,
          h("div", { class: "name" }, l.name),
          h("div", { style: "font-size:11px; color:var(--ink-3); margin-top:2px;" },
            l.pa + " PA \u00B7 " + l.h + "H \u00B7 " + l.k + "K"),
        ),
        h("div", { class: "avg" }, A.fmtAvg(l.avg)),
        h("div", { class: "avg" }, A.fmtAvg(l.obp)),
        h("div", { class: "avg" }, A.fmtAvg(l.ops)),
      ));
    });
    const header = h("div", { class: "lineup-row", style: "grid-template-columns: 1fr 60px 60px 50px; color:var(--ink-3); font-weight:700; font-size:10px; letter-spacing:.14em; text-transform:uppercase;" },
      h("div", null, "Player"),
      h("div", { class: "avg" }, "AVG"),
      h("div", { class: "avg" }, "OBP"),
      h("div", { class: "avg" }, "OPS"),
    );
    const wrap = h("div", null, header, list);
    return wrap;
  }

  global.SC.views = global.SC.views || {};
  global.SC.views.stats = { render };
})(window);
