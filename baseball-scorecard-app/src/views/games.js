/* Games list view (minimal) */
(function (global) {
  "use strict";
  const I = global.SC.icons;
  const A = global.SC.analytics;

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
    const view = h("div", null);
    view.appendChild(h("div", { class: "appbar" },
      h("div", null),
      h("div", { class: "title" }, "Games"),
      h("button", { class: "icon-btn", onClick: () => store.reset(), html: I.more }),
    ));

    const list = h("div", { class: "games-list" });
    list.appendChild(h("div", { class: "game-card live", onClick: () => store.set({ tab: "scorecard" }) },
      h("div", { class: "team-row" },
        h("div", { class: "team-logo", html: I[g.home.logo] }),
        h("div", null,
          h("div", { class: "team-name", style: "font-size:13px; letter-spacing:0; text-transform:none; font-weight:600; color:var(--ink);" }, g.home.name),
          h("div", { style: "font-size:11px; color:var(--ink-3); margin-top:2px;" }, g.home.abbrev),
        ),
      ),
      h("div", { class: "vs" },
        sumRuns(g.home) + " - " + sumRuns(g.away),
      ),
      h("div", { class: "team-row right", style: "justify-content:flex-end;" },
        h("div", { style: "text-align:right;" },
          h("div", { class: "team-name", style: "font-size:13px; letter-spacing:0; text-transform:none; font-weight:600; color:var(--ink);" }, g.away.name),
          h("div", { style: "font-size:11px; color:var(--ink-3); margin-top:2px;" }, g.away.abbrev),
        ),
        h("div", { class: "team-logo", html: I[g.away.logo] }),
      ),
      h("div", { class: "meta" }, (g.half === "top" ? "Top " : "Bot ") + ordinal(g.inning) + " \u00B7 Live"),
    ));

    view.appendChild(list);

    view.appendChild(h("div", { class: "empty" },
      h("div", { class: "h" }, "One game at a time"),
      h("div", { class: "b" }, "Tap the game above to open the scorecard."),
    ));
    return view;
  }

  function sumRuns(team) { return team.runsByInning.reduce((a, b) => a + (b || 0), 0); }
  function ordinal(n) {
    const s = ["th","st","nd","rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  global.SC.views = global.SC.views || {};
  global.SC.views.games = { render };
})(window);
