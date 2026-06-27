/* App shell: mounts root and handles tab routing + sheet overlays. */
(function (global) {
  "use strict";
  const I = global.SC.icons;
  const V = global.SC.views;

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

  function tabBar(state, store) {
    const tab = state.tab;
    const b = (key, label, icon) => h("button", {
      class: tab === key ? "active" : "",
      onClick: () => store.set({ tab: key }),
    }, h("span", { html: icon }), h("span", null, label));
    return h("div", { class: "tabbar" },
      b("games", "Games", I.games),
      b("scorecard", "Scorecard", I.scorecardIcon),
      b("lineup", "Lineup", I.lineup),
      b("stats", "Stats", I.stats),
      b("more", "More", I.moreDots),
    );
  }

  function mount() {
    const root = document.getElementById("app");
    const store = global.SC.createStore();

    function paint() {
      const state = store.get();
      root.innerHTML = "";

      let view;
      switch (state.tab) {
        case "games":     view = V.games.render(state, store); break;
        case "lineup":    view = V.lineup.render(state, store); break;
        case "stats":     view = V.stats.render(state, store); break;
        case "more":      view = moreView(state, store); break;
        case "scorecard":
        default:          view = V.scorecard.render(state, store); break;
      }
      root.appendChild(view);
      root.appendChild(tabBar(state, store));

      if (state.sheet) {
        if (state.sheet.type === "playPicker")  root.appendChild(V.playPicker.render(state, store));
        if (state.sheet.type === "hitLocation") root.appendChild(V.hitLocation.render(state, store));
      }
      if (state.toast) {
        const t = h("div", { class: "toast" }, state.toast.msg);
        root.appendChild(t);
      }
    }

    store.subscribe(paint);
    paint();

    // expose for debugging
    global.__SC_STORE__ = store;
  }

  function moreView(state, store) {
    const g = state.game;
    const view = h("div", null);
    view.appendChild(h("div", { class: "appbar" },
      h("div", null),
      h("div", { class: "title" }, "More"),
      h("div", null),
    ));
    view.appendChild(h("div", { class: "stats-section" },
      h("div", { class: "stats-title" }, "Game Controls"),
      h("div", { style: "display:flex; flex-direction:column; gap:8px;" },
        bigBtn("Load Demo Game", () => store.seedDemo()),
        bigBtn("New Blank Game", () => store.reset()),
        bigBtn("Record Ball",   () => store.patchGame((gg) => global.SC.pitch(gg, "ball"))),
        bigBtn("Record Strike", () => store.patchGame((gg) => global.SC.pitch(gg, "strike"))),
        bigBtn("Record Foul",   () => store.patchGame((gg) => global.SC.pitch(gg, "foul"))),
      ),
    ));
    view.appendChild(h("div", { class: "stats-section" },
      h("div", { class: "stats-title" }, "About"),
      h("div", { class: "kpi-card" },
        h("div", { class: "label" }, "Scorecard"),
        h("div", { class: "value", style: "font-size:14px;" }, "A sleek iPhone scorecard"),
        h("div", { class: "sub" },
          "Tap any at-bat cell to record a play. Hits ask you to pick a field location, and every stat in Advanced Analytics updates instantly."),
      ),
    ));
    return view;
  }

  function bigBtn(label, onClick) {
    return h("button", {
      onClick,
      style: "background:var(--bg-elev); border:1px solid var(--line); border-radius:12px; padding:14px; font-weight:600; text-align:left; font-size:14px;",
    }, label);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})(window);
