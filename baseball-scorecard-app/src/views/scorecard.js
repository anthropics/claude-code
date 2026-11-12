/* Scorecard main view */
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
      else if (k === "style") el.setAttribute("style", attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return el;
  }

  function sum(arr) { return arr.reduce((a, b) => a + (b || 0), 0); }

  function render(state, store) {
    const g = state.game;
    const sc = h("div", { class: "scorecard-view" });

    // App bar
    sc.appendChild(
      h("div", { class: "appbar" },
        h("button", { class: "icon-btn", "aria-label": "back", onClick: () => store.set({ tab: "games" }), html: I.back }),
        h("div", { class: "title" }, "Scorecard"),
        h("button", { class: "icon-btn", "aria-label": "more", onClick: () => openMenu(store), html: I.more }),
      ),
    );

    // Game header
    const homeRuns = sum(g.home.runsByInning);
    const awayRuns = sum(g.away.runsByInning);
    sc.appendChild(
      h("div", { class: "gameheader" },
        h("div", { class: "team-block" },
          h("div", { class: "team-logo", html: I[g.home.logo] || I.paw }),
          h("div", { class: "team-meta" },
            h("div", { class: "team-name" }, g.home.name),
            h("div", { class: "team-score" }, String(homeRuns)),
          ),
        ),
        h("div", { class: "inning-block" },
          h("div", { class: "inning-label" }, (g.half === "top" ? "Top " : "Bot ") + ordinal(g.inning)),
          h("div", { class: "inning-arrow", html: g.half === "top" ? I.topArrow : I.botArrow }),
        ),
        h("div", { class: "team-block right" },
          h("div", { class: "team-meta" },
            h("div", { class: "team-name" }, g.away.name),
            h("div", { class: "team-score" }, String(awayRuns)),
          ),
          h("div", { class: "team-logo", html: I[g.away.logo] || I.eagle }),
        ),
      ),
    );

    // Status row
    sc.appendChild(
      h("div", { class: "statusrow" },
        h("div", { class: "status-cell" },
          h("div", { class: "v" }, String(g.balls), " - ", String(g.strikes)),
          h("div", { class: "l" }, "Count"),
        ),
        h("div", { class: "status-cell" },
          h("div", { class: "v" }, String(g.outs), h("small", null, g.outs === 1 ? "OUT" : "OUTS")),
        ),
        h("div", { class: "status-cell" },
          h("div", { class: "v" }, "P: " + g.pitches),
          h("div", { class: "l" }, "Pitches"),
        ),
      ),
    );

    // Scorecard grid — shows the team currently batting + fielding? We show the batting team by default
    // and a toggle via app bar "more" menu. For simplicity, show batting team.
    const battingTeam = g.half === "top" ? g.away : g.home;
    sc.appendChild(buildGrid(battingTeam, g, store));

    // Bottom panel
    sc.appendChild(buildBottomPanel(g, battingTeam));

    return sc;
  }

  function buildGrid(team, g, store) {
    const wrap = h("div", { class: "scorecard-wrap" });
    const table = h("table", { class: "scorecard-table" });
    const innings = 11;

    // Header
    const thead = h("thead");
    const tr = h("tr");
    tr.appendChild(h("th", null, "#"));
    tr.appendChild(h("th", null, "Player"));
    tr.appendChild(h("th", null, "Pos"));
    for (let i = 1; i <= innings; i++) tr.appendChild(h("th", null, String(i)));
    tr.appendChild(h("th", null, "AB"));
    tr.appendChild(h("th", null, "R"));
    tr.appendChild(h("th", null, "H"));
    tr.appendChild(h("th", null, "RBI"));
    thead.appendChild(tr);
    table.appendChild(thead);

    const tbody = h("tbody");
    team.players.forEach((p, pIdx) => {
      const line = A.playerLine(p);
      const row = h("tr");
      row.appendChild(h("td", { class: "row-num" }, String(pIdx + 1)));
      row.appendChild(h("td", { class: "col-name" }, p.name));
      row.appendChild(h("td", { class: "col-pos" }, p.pos));
      for (let i = 0; i < innings; i++) {
        const cell = p.atBats[i];
        const td = h("td", { class: "ab-cell" });
        const active = g.activeAB.side === (team === g.home ? "bot" : "top") &&
                       g.activeAB.playerIdx === pIdx &&
                       g.activeAB.inning === i + 1;
        if (active) td.classList.add("active");
        if (cell) {
          td.innerHTML = global.SC.renderCell(cell);
        }
        td.addEventListener("click", () => {
          const side = team === g.home ? "bot" : "top";
          store.patchGame((game) => global.SC.setActiveCell(game, side, pIdx, i + 1));
          store.set({ sheet: { type: "playPicker" } });
        });
        row.appendChild(td);
      }
      row.appendChild(h("td", { class: "stat-cell" }, String(line.ab)));
      row.appendChild(h("td", { class: "stat-cell" }, String(line.r)));
      row.appendChild(h("td", { class: "stat-cell" }, String(line.h)));
      row.appendChild(h("td", { class: "stat-cell" }, String(line.rbi)));
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function buildBottomPanel(g, battingTeam) {
    // Field mini
    const field = h("div", { class: "field-mini" },
      h("div", { class: "label" }, "Home\u00A0\u00A0Defense"),
    );

    // Pitcher stats
    const pSide = g.half === "top" ? "top" : "bot";
    const pitcher = g.pitchers[pSide];
    const pLine = A.pitcherLine(pitcher);

    const pitcherBlock = h("div", null,
      h("div", { class: "mini-block-title" }, "Pitcher"),
      (() => {
        const t = h("table", { class: "mini-table" });
        const thr = h("tr"); ["IP","H","R","ER","BB","K"].forEach((k) => thr.appendChild(h("th", null, k)));
        const tbr = h("tr");
        tbr.appendChild(h("td", null, A.fmtIP(pitcher.ip)));
        tbr.appendChild(h("td", null, String(pitcher.h)));
        tbr.appendChild(h("td", null, String(pitcher.r)));
        tbr.appendChild(h("td", null, String(pitcher.er)));
        tbr.appendChild(h("td", null, String(pitcher.bb)));
        tbr.appendChild(h("td", null, String(pitcher.k)));
        t.appendChild(thr); t.appendChild(tbr);
        return t;
      })(),
    );

    // Team line
    const teamBlock = h("div", null,
      h("div", { class: "mini-block-title" }, "Team"),
      buildTeamLine(g),
      buildFinalLine(g),
    );

    return h("div", { class: "bottom-panel" }, field, pitcherBlock, teamBlock);
  }

  function buildTeamLine(g) {
    const wrap = h("div", null);
    const innings = 11;
    // Header row
    const head = h("div", { class: "team-line" });
    head.appendChild(h("div", { class: "cell head" }, ""));
    for (let i = 1; i <= innings; i++) head.appendChild(h("div", { class: "cell head" }, String(i)));
    wrap.appendChild(head);

    // Home & away rows
    for (const team of [g.home, g.away]) {
      const row = h("div", { class: "team-line" });
      row.appendChild(h("div", { class: "cell team" }, team.abbrev.slice(0, 3)));
      for (let i = 0; i < innings; i++) {
        const v = team.runsByInning[i];
        const c = h("div", { class: "cell" + (v > 0 ? " run" : "") }, v == null ? "" : String(v));
        row.appendChild(c);
      }
      wrap.appendChild(row);
    }
    return wrap;
  }

  function buildFinalLine(g) {
    const wrap = h("div", null);
    const awayR = sum(g.away.runsByInning);
    const homeR = sum(g.home.runsByInning);
    const awayH = A.teamTotals(g.away).h;
    const homeH = A.teamTotals(g.home).h;
    const awayE = 0, homeE = 0; // errors — not yet tracked at this level
    const awayLOB = g.away.lob || 0;
    const homeLOB = g.home.lob || 0;

    const head = h("div", { class: "final-line" },
      h("div", { class: "label" }, "Final"),
      h("div", { class: "label" }, "R"),
      h("div", { class: "label" }, "H"),
      h("div", { class: "label" }, "E"),
      h("div", { class: "label" }, "LOB"),
    );
    const rowA = h("div", { class: "final-line" },
      h("div", { class: "label" }, g.home.abbrev.slice(0, 3)),
      h("div", { class: "v" }, String(homeR)),
      h("div", { class: "v" }, String(homeH)),
      h("div", { class: "v" }, String(homeE)),
      h("div", { class: "v" }, String(homeLOB)),
    );
    const rowB = h("div", { class: "final-line" },
      h("div", { class: "label" }, g.away.abbrev.slice(0, 3)),
      h("div", { class: "v" }, String(awayR)),
      h("div", { class: "v" }, String(awayH)),
      h("div", { class: "v" }, String(awayE)),
      h("div", { class: "v" }, String(awayLOB)),
    );
    wrap.appendChild(head);
    wrap.appendChild(rowA);
    wrap.appendChild(rowB);
    return wrap;
  }

  function sum(arr) { return arr.reduce((a, b) => a + (b || 0), 0); }

  function ordinal(n) {
    const s = ["th","st","nd","rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function openMenu(store) {
    const choices = [
      ["New game", () => store.reset()],
      ["Load demo", () => store.seedDemo()],
      ["Cancel", null],
    ];
    const pick = prompt("Menu:\n1. New game\n2. Load demo\n3. Cancel\n\nEnter 1, 2, or 3:");
    if (pick === "1") store.reset();
    if (pick === "2") store.seedDemo();
  }

  global.SC.views = global.SC.views || {};
  global.SC.views.scorecard = { render };
})(window);
