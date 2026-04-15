/* Hit location sheet with a baseball diamond. */
(function (global) {
  "use strict";
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
    const playId = state.sheet.playId;
    const scrim = h("div", { class: "scrim", onClick: (e) => { if (e.target === e.currentTarget) close(store); } });
    const g = state.game;
    const header = h("div", { class: "sheet-header" },
      h("button", { class: "sheet-close", onClick: () => close(store), html: I.close }),
      h("div", { class: "sheet-title" }, "Select Hit Location"),
      h("button", { class: "sheet-close", html: I.info, "aria-label": "info" }),
    );
    const sub = h("div", { style: "text-align:center; font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-3); font-weight:700; margin:-6px 0 8px;" },
      (g.half === "top" ? "Top " : "Bot ") + ordinal(g.inning) + "   " + g.outs + " " + (g.outs === 1 ? "OUT" : "OUTS"),
    );
    const field = buildField(playId, store);
    const foul = h("div", { class: "foul-row" },
      h("button", { class: "foul-btn", onClick: () => record(store, playId, "FOUL-L") }, "Foul Left"),
      h("button", { class: "foul-btn no-hit", onClick: () => record(store, playId, null) }, "No Hit"),
      h("button", { class: "foul-btn", onClick: () => record(store, playId, "FOUL-R") }, "Foul Right"),
    );
    const recent = h("div", { class: "recent-row" },
      h("div", { class: "recent-label" }, "Recent"),
      ...recentPills(g).map((id) => h("button", { class: "recent-pill", onClick: () => record(store, id, null) }, id)),
    );
    const cancel = h("button", { class: "sheet-cancel", onClick: () => close(store) }, "Cancel");

    const sheet = h("div", { class: "sheet" },
      h("div", { class: "sheet-grab" }),
      header, sub,
      h("div", { class: "sheet-tabs" },
        h("button", { class: "active" }, "Field"),
        h("button", null, "Outs"),
        h("button", null, "Runners"),
      ),
      field, foul, recent, cancel,
    );
    scrim.appendChild(sheet);
    return scrim;
  }

  function recentPills(g) {
    const seen = [];
    for (let i = g.log.length - 1; i >= 0 && seen.length < 5; i--) {
      const id = g.log[i].play;
      if (seen.indexOf(id) === -1) seen.push(id);
    }
    if (seen.length === 0) return ["1B", "2B", "K", "BB", "FO"];
    return seen;
  }

  function buildField(playId, store) {
    const wrap = h("div", { class: "hit-field" });
    // SVG diamond field with zones
    wrap.innerHTML = `
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
        <!-- Outfield arc -->
        <path d="M 40 220 A 180 180 0 0 1 360 220 Z" fill="#b9d3a3" stroke="#8aaa72" stroke-width="1"/>
        <!-- Infield dirt -->
        <path d="M 200 235 L 120 165 L 200 105 L 280 165 Z" fill="#d9b89a" stroke="#b48a68" stroke-width="1"/>
        <!-- Outfield lines -->
        <line x1="200" y1="235" x2="40" y2="75"  stroke="#fff" stroke-width="1" opacity=".7"/>
        <line x1="200" y1="235" x2="360" y2="75" stroke="#fff" stroke-width="1" opacity=".7"/>

        <!-- Clickable zones (invisible) -->
        <path class="field-zone outfield" data-zone="LF" d="M 200 235 L 40 75 A 220 220 0 0 1 133 55 Z"/>
        <path class="field-zone outfield" data-zone="CF" d="M 200 235 L 133 55 A 220 220 0 0 1 267 55 Z"/>
        <path class="field-zone outfield" data-zone="RF" d="M 200 235 L 267 55 A 220 220 0 0 1 360 75 Z"/>

        <path class="field-zone infield" data-zone="3B" d="M 200 235 L 120 165 L 150 132 L 200 165 Z"/>
        <path class="field-zone infield" data-zone="SS" d="M 200 235 L 150 132 L 200 105 L 200 165 Z"/>
        <path class="field-zone infield" data-zone="2B" d="M 200 235 L 200 105 L 250 132 L 200 165 Z"/>
        <path class="field-zone infield" data-zone="1B" d="M 200 235 L 250 132 L 280 165 L 200 165 Z"/>

        <!-- Labels -->
        <text class="field-label" x="85"  y="115">7</text>
        <text class="field-label sub" x="85"  y="130">LF</text>
        <text class="field-label" x="200" y="85">8</text>
        <text class="field-label sub" x="200" y="100">CF</text>
        <text class="field-label" x="315" y="115">9</text>
        <text class="field-label sub" x="315" y="130">RF</text>

        <text class="field-label" x="158" y="162">6</text>
        <text class="field-label sub" x="158" y="176">SS</text>
        <text class="field-label" x="242" y="162">4</text>
        <text class="field-label sub" x="242" y="176">2B</text>
        <text class="field-label" x="138" y="190">5</text>
        <text class="field-label sub" x="138" y="204">3B</text>
        <text class="field-label" x="262" y="190">3</text>
        <text class="field-label sub" x="262" y="204">1B</text>

        <!-- Bases (white diamonds) -->
        <rect x="196" y="161" width="8" height="8" transform="rotate(45 200 165)" fill="#fff" stroke="#999"/>
        <rect x="146" y="128" width="8" height="8" transform="rotate(45 150 132)" fill="#fff" stroke="#999"/>
        <rect x="246" y="128" width="8" height="8" transform="rotate(45 250 132)" fill="#fff" stroke="#999"/>
        <rect x="196" y="101" width="8" height="8" transform="rotate(45 200 105)" fill="#fff" stroke="#999"/>

        <!-- Home plate button -->
        <circle class="home-plate-btn" cx="200" cy="235" r="12" />
        <text x="200" y="240" text-anchor="middle" font-size="16" fill="#8a8278" font-weight="700">-</text>
      </svg>
    `;

    wrap.querySelectorAll(".field-zone").forEach((el) => {
      el.addEventListener("click", () => {
        const zone = el.getAttribute("data-zone");
        el.classList.add("touched");
        setTimeout(() => record(store, playId, zone), 120);
      });
    });
    return wrap;
  }

  function record(store, playId, zone) {
    store.patchGame((g) => global.SC.recordPlay(g, playId, {
      hitLocation: zone,
      pitches: estPitches(playId),
    }));
    store.set({ sheet: null });
    store.toast((zone ? zone + " — " : "") + prettyName(playId));
  }

  function estPitches(id) {
    return { "1B": 3, "2B": 4, "3B": 5, "HR": 4, "BB": 5, "K": 4, "GO": 3, "FO": 3, "LO": 2, "PO": 3, "SF": 4, "E": 3, "HBP": 2, "FC": 3, "FOR": 3 }[id] || 3;
  }

  function prettyName(id) {
    return ({ "1B":"Single","2B":"Double","3B":"Triple","HR":"Home Run","BB":"Walk","K":"Strike Out","GO":"Groundout","FO":"Flyout","LO":"Lineout","PO":"Pop Out","SF":"Sacrifice","E":"Error","HBP":"Hit by Pitch","FC":"Fielders Choice","FOR":"Force Out","SB":"Stolen Base" })[id] || id;
  }

  function close(store) { store.set({ sheet: null }); }

  function ordinal(n) {
    const s = ["th","st","nd","rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  global.SC.views = global.SC.views || {};
  global.SC.views.hitLocation = { render };
})(window);
