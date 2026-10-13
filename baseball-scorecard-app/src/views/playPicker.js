/* Play picker sheet */
(function (global) {
  "use strict";
  const I = global.SC.icons;
  const P = global.SC.playIcons;

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

  const BATTING = [
    { id: "1B",  name: "Single" },
    { id: "2B",  name: "Double" },
    { id: "3B",  name: "Triple" },
    { id: "HR",  name: "Home Run" },
    { id: "BB",  name: "Walk" },
    { id: "K",   name: "Strike Out" },
    { id: "GO",  name: "Groundout" },
    { id: "FO",  name: "Flyout" },
    { id: "LO",  name: "Lineout" },
    { id: "PO",  name: "Pop Out" },
    { id: "SF",  name: "Sacrifice" },
    { id: "E",   name: "Error" },
    { id: "HBP", name: "Hit by Pitch" },
    { id: "FC",  name: "Fielders Choice" },
    { id: "FOR", name: "Force Out" },
    { id: "SB",  name: "Stolen Base" },
  ];

  const PITCHING = [
    { id: "BB", name: "Walk" },
    { id: "K",  name: "Strike Out" },
    { id: "HBP",name: "Hit by Pitch" },
  ];

  function render(state, store) {
    const tab = (state.sheet && state.sheet.picker) || "BATTING";
    const scrim = h("div", { class: "scrim", onClick: (e) => { if (e.target === e.currentTarget) close(store); } });
    const sheet = h("div", { class: "sheet" },
      h("div", { class: "sheet-grab" }),
      h("div", { class: "sheet-header" },
        h("div", null),
        h("div", { class: "sheet-title" }, "Select Play"),
        h("button", { class: "sheet-close", onClick: () => close(store), html: I.close }),
      ),
      h("div", { class: "sheet-tabs" },
        tabBtn("Batting",  tab === "BATTING",  () => store.set({ sheet: { type: "playPicker", picker: "BATTING" } })),
        tabBtn("Pitching", tab === "PITCHING", () => store.set({ sheet: { type: "playPicker", picker: "PITCHING" } })),
        tabBtn("Other",    tab === "OTHER",    () => store.set({ sheet: { type: "playPicker", picker: "OTHER" } })),
      ),
      h("div", { class: "play-grid" }, ...(
        (tab === "BATTING" ? BATTING : tab === "PITCHING" ? PITCHING : [{ id: "SB", name: "Stolen Base" }])
        .map((p) => h("button", { class: "play-tile", onClick: () => pick(store, p.id) },
          h("div", { class: "icon", html: P[p.id] || "" }),
          h("div", { class: "name" }, p.name),
        ))
      )),
      h("button", { class: "sheet-cancel", onClick: () => close(store) }, "Cancel"),
    );
    scrim.appendChild(sheet);
    return scrim;
  }

  function tabBtn(label, active, onClick) {
    const b = h("button", { onClick }, label);
    if (active) b.classList.add("active");
    return b;
  }

  function close(store) { store.set({ sheet: null }); }

  function pick(store, playId) {
    // For hits, open hit-location next so we can populate spray chart.
    const hitTypes = ["1B", "2B", "3B", "HR", "GO", "FO", "LO", "PO", "SF", "E", "FC"];
    if (hitTypes.indexOf(playId) >= 0) {
      store.set({ sheet: { type: "hitLocation", playId } });
    } else {
      store.patchGame((g) => global.SC.recordPlay(g, playId, { pitches: estPitches(playId) }));
      store.set({ sheet: null });
      store.toast(nameOf(playId) + " recorded");
    }
  }

  function estPitches(id) {
    // Rough pitches per outcome (used to advance P: counter)
    return { "1B": 3, "2B": 4, "3B": 5, "HR": 4, "BB": 5, "K": 4, "GO": 3, "FO": 3, "LO": 2, "PO": 3, "SF": 4, "E": 3, "HBP": 2, "FC": 3, "FOR": 3, "SB": 0 }[id] || 3;
  }

  function nameOf(id) {
    const all = [...BATTING, ...PITCHING, { id: "SB", name: "Stolen Base" }];
    const x = all.find((p) => p.id === id);
    return x ? x.name : id;
  }

  global.SC.views = global.SC.views || {};
  global.SC.views.playPicker = { render };
})(window);
