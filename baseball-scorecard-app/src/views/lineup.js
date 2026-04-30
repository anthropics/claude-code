/* Lineup view */
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
    const view = h("div", null);
    view.appendChild(h("div", { class: "appbar" },
      h("button", { class: "icon-btn", onClick: () => store.set({ tab: "scorecard" }), html: I.back }),
      h("div", { class: "title" }, "Lineup"),
      h("button", { class: "icon-btn", html: I.more }),
    ));

    const which = (state.lineupTeam) || (g.half === "top" ? "away" : "home");
    const toggle = h("div", { class: "sheet-tabs", style: "margin:8px 0;" },
      tabBtn(g.home.name, which === "home", () => store.set({ lineupTeam: "home" })),
      tabBtn(g.away.name, which === "away", () => store.set({ lineupTeam: "away" })),
    );
    view.appendChild(toggle);

    const team = g[which];
    const list = h("div", { class: "lineup-list" });
    team.players.forEach((p, i) => {
      const L = A.playerLine(p);
      list.appendChild(h("div", { class: "lineup-row" },
        h("div", { class: "num" }, String(i + 1)),
        h("div", null,
          h("div", { class: "name" }, p.name),
          h("div", { style: "font-size:11px; color:var(--ink-3); margin-top:2px;" },
            L.pa + " PA  \u00B7  " + L.h + "H  \u00B7  " + L.rbi + " RBI"
          ),
        ),
        h("div", { class: "pos" }, p.pos),
        h("div", { class: "avg" }, A.fmtAvg(L.avg)),
      ));
    });
    view.appendChild(list);
    return view;
  }

  function tabBtn(label, active, onClick) {
    const b = h("button", { onClick }, label);
    if (active) b.classList.add("active");
    return b;
  }

  global.SC.views = global.SC.views || {};
  global.SC.views.lineup = { render };
})(window);
