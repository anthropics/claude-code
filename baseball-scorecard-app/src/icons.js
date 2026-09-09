/* ---------- Icons ----------
 * Inline SVGs returned as DOM strings. No emoji; simple line-art.
 */
(function (global) {
  "use strict";

  const stroke = "currentColor";
  const sw = "1.6";

  const icons = {
    back: `<svg viewBox="0 0 24 24" fill="none"><path d="M15 5L8 12l7 7" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/></svg>`,
    more: `<svg viewBox="0 0 24 24" fill="none"><circle cx="5"  cy="12" r="1.6" fill="${stroke}"/><circle cx="12" cy="12" r="1.6" fill="${stroke}"/><circle cx="19" cy="12" r="1.6" fill="${stroke}"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="${stroke}" stroke-width="${sw}"/><path d="M12 11v5M12 7.5v.5" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/></svg>`,

    // Team mascots — abstract, no emoji
    paw: `<svg viewBox="0 0 40 40" fill="none">
      <ellipse cx="20" cy="26" rx="8" ry="6.5" fill="${stroke}"/>
      <circle cx="11" cy="19" r="3" fill="${stroke}"/>
      <circle cx="29" cy="19" r="3" fill="${stroke}"/>
      <circle cx="15" cy="12" r="2.4" fill="${stroke}"/>
      <circle cx="25" cy="12" r="2.4" fill="${stroke}"/>
    </svg>`,
    eagle: `<svg viewBox="0 0 40 40" fill="none">
      <path d="M6 24c4-2 9-3 14-3s10 1 14 3c-3 3-8 5-14 5S9 27 6 24z" fill="${stroke}"/>
      <path d="M14 22l6-8 6 8" fill="${stroke}"/>
      <circle cx="20" cy="11" r="2.4" fill="${stroke}"/>
      <path d="M22 12.5l4-1-3 2.5" fill="${stroke}"/>
    </svg>`,

    // Tab bar
    games:    `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="${stroke}" stroke-width="${sw}"/><path d="M5 9c2 2 12 2 14 0M5 15c2-2 12-2 14 0" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/></svg>`,
    scorecardIcon: `<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2" stroke="${stroke}" stroke-width="${sw}"/><path d="M4 10h16M10 5v14M15 5v14" stroke="${stroke}" stroke-width="${sw}"/></svg>`,
    lineup:   `<svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="9" r="3" stroke="${stroke}" stroke-width="${sw}"/><circle cx="17" cy="10" r="2.2" stroke="${stroke}" stroke-width="${sw}"/><path d="M3 19c1-3 4-4 6-4s5 1 6 4M15 19c.5-2 2-3 4-3s3.5 1 4 3" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/></svg>`,
    stats:    `<svg viewBox="0 0 24 24" fill="none"><path d="M4 20V10M10 20V5M16 20v-7M22 20H2" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/></svg>`,
    moreDots: `<svg viewBox="0 0 24 24" fill="none"><circle cx="5"  cy="12" r="1.6" fill="${stroke}"/><circle cx="12" cy="12" r="1.6" fill="${stroke}"/><circle cx="19" cy="12" r="1.6" fill="${stroke}"/></svg>`,

    // Inning pointer: filled diamond w/ triangle marker
    topArrow: `<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="5" width="14" height="14" rx="2" transform="rotate(45 12 12)" stroke="${stroke}" stroke-width="1.4"/><path d="M8 12h8" stroke="${stroke}" stroke-width="1.4"/><path d="M12 6l0 6" stroke="${stroke}" stroke-width="1.4"/></svg>`,
    botArrow: `<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="5" width="14" height="14" rx="2" transform="rotate(45 12 12)" stroke="${stroke}" stroke-width="1.4"/><path d="M8 12h8" stroke="${stroke}" stroke-width="1.4"/><path d="M12 18l0 -6" stroke="${stroke}" stroke-width="1.4"/></svg>`,

    // Home plate used in field-mini
    home: `<svg viewBox="0 0 60 60" fill="none">
      <path d="M30 12l18 14v18c0 3-2 5-5 5H17c-3 0-5-2-5-5V26l18-14z" stroke="${stroke}" stroke-width="1" fill="none"/>
    </svg>`,
  };

  // Play tile icons. Most are diamonds w/ overlay letters, like the mockup.
  function diamond(fill, label, color) {
    const fc = fill === "full" ? "#6e9a5a" : fill === "half" ? "#6e9a5a" : "none";
    const inner = fill === "full" ? `<rect x="22" y="22" width="26" height="26" transform="rotate(45 35 35)" fill="${fc}"/>` :
                  fill === "half" ? `<path d="M35 17 L53 35 L35 53 Z" fill="${fc}"/>` :
                  fill === "out"  ? `<path d="M35 17 L53 35 L35 53 L17 35 Z" fill="none" stroke="#b94a3a" stroke-width="1.4"/><ellipse cx="35" cy="35" rx="13" ry="9" fill="none" stroke="#b94a3a" stroke-width="1.2"/>` :
                  "";
    const stroke = fill === "out" ? "#b94a3a" : "#2a261f";
    return `<svg viewBox="0 0 70 70" fill="none">
      <path d="M35 10 L60 35 L35 60 L10 35 Z" stroke="${stroke}" stroke-width="1.2" fill="none"/>
      ${inner}
      ${label ? `<text x="35" y="8" text-anchor="middle" font-size="10" font-weight="700" fill="${color || '#2a261f'}" font-family="inherit">${label}</text>` : ""}
    </svg>`;
  }

  const plays = {
    "1B":  diamond("full", "", "#4a7a3a"),
    "2B":  diamond("half", "", "#4a7a3a"),
    "3B":  diamond("full", "", "#4a7a3a"), // will show separately
    "HR":  diamond(null, "HR", "#2a261f"),
    "BB":  diamond(null, "BB", "#2a261f"),
    "K":   diamond(null, "K",  "#2a261f"),
    "GO":  diamond("out", "GO", "#b94a3a"),
    "FO":  diamond(null, "FO", "#2a261f"),
    "LO":  diamond(null, "LO", "#2a261f"),
    "PO":  diamond(null, "PO", "#2a261f"),
    "SF":  diamond(null, "SF", "#2a261f"),
    "E":   diamond(null, "E",  "#2a261f"),
    "HBP": diamond(null, "HBP","#2a261f"),
    "FC":  diamond(null, "FC", "#2a261f"),
    "FOR": diamond(null, "FO", "#2a261f"),
    "SB":  diamond(null, "SB", "#2a261f"),
  };
  // Make 3B distinct visually: full triangle tip
  plays["3B"] = `<svg viewBox="0 0 70 70" fill="none">
    <path d="M35 10 L60 35 L35 60 L10 35 Z" stroke="#2a261f" stroke-width="1.2" fill="none"/>
    <path d="M35 10 L60 35 L35 60 Z" fill="#6e9a5a"/>
  </svg>`;
  // HR: full diamond solid
  plays["HR"] = `<svg viewBox="0 0 70 70" fill="none">
    <path d="M35 10 L60 35 L35 60 L10 35 Z" stroke="#2a261f" stroke-width="1.2" fill="#6e9a5a"/>
    <text x="35" y="6" text-anchor="middle" font-size="9" font-weight="700" fill="#2a261f" font-family="inherit">HR</text>
  </svg>`;

  global.SC.icons = icons;
  global.SC.playIcons = plays;

  /** Render a cell's diamond for the scorecard grid based on at-bat result. */
  global.SC.renderCell = function renderCell(cell) {
    if (!cell) return "";
    const play = SC.PLAYS[cell.play];
    if (!play) return "";
    const color = play.color;
    const base = `<svg viewBox="0 0 44 44" fill="none" preserveAspectRatio="xMidYMid meet" style="position:absolute;inset:2px;">
      <path d="M22 5 L39 22 L22 39 L5 22 Z" stroke="#d8cdb3" stroke-width="0.9" fill="none"/>
    </svg>`;
    let shape = "";
    if (play.id === "1B")
      shape = `<svg viewBox="0 0 44 44" style="position:absolute;inset:2px;"><rect x="14" y="14" width="16" height="16" transform="rotate(45 22 22)" fill="#6e9a5a"/></svg>`;
    else if (play.id === "2B")
      shape = `<svg viewBox="0 0 44 44" style="position:absolute;inset:2px;"><path d="M22 5 L39 22 L22 39 Z" fill="#6e9a5a"/></svg>`;
    else if (play.id === "3B")
      shape = `<svg viewBox="0 0 44 44" style="position:absolute;inset:2px;"><path d="M22 5 L39 22 L22 39 L5 22 Z" fill="#6e9a5a" opacity=".85"/></svg>`;
    else if (play.id === "HR")
      shape = `<svg viewBox="0 0 44 44" style="position:absolute;inset:2px;"><path d="M22 5 L39 22 L22 39 L5 22 Z" fill="#6e9a5a"/></svg>`;
    else if (play.id === "BB" || play.id === "HBP")
      shape = `<svg viewBox="0 0 44 44" style="position:absolute;inset:2px;"><path d="M22 22 L5 22 L22 39 Z" fill="#6e9a5a" opacity=".5"/></svg>`;
    // The letter label on top
    const label = play.short;
    let cls = "cell-label";
    if (play.h) cls += " hit";
    else if (play.id === "K") cls += " k";
    else if (play.id === "BB" || play.id === "HBP") cls += " bb";
    else cls += " out";
    const ring = (play.id === "GO" || play.id === "FOR") ? `<svg viewBox="0 0 44 44" style="position:absolute;inset:6px;"><ellipse cx="22" cy="22" rx="14" ry="9" fill="none" stroke="#b94a3a" stroke-width="1.1"/></svg>` : "";
    return base + shape + ring + `<div class="${cls}">${label}</div>`;
  };
})(window);
