/* ---------- Icons ----------
 * Inline SVGs returned as strings. No emoji; simple line-art in the same
 * spirit as the baseball scorecard app.
 */
(function (global) {
  "use strict";

  var stroke = "currentColor";
  var sw = "1.6";

  // Arrowhead silhouette — the brand mark, used as tab icon and map marker.
  function arrowheadSvg(fill, strokeColor) {
    fill = fill || "none";
    strokeColor = strokeColor || stroke;
    return '<svg viewBox="0 0 24 24" fill="none">' +
      '<path d="M12 2 L19 12 L15 21 L12 19 L9 21 L5 12 Z" fill="' + fill + '" stroke="' + strokeColor + '" stroke-width="' + sw + '" stroke-linejoin="round"/>' +
      '<path d="M12 6 L12 17" stroke="' + strokeColor + '" stroke-width="1" stroke-linecap="round" opacity="0.5"/>' +
      '</svg>';
  }

  // Larger pinned-marker version for the Leaflet divIcon.
  function arrowheadMarkerSvg(color) {
    color = color || "#7a3a2a";
    return '<svg viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M20 2 L32 20 L26 38 L20 34 L14 38 L8 20 Z" fill="' + color + '" stroke="#2a1a10" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M20 8 L20 32" stroke="#2a1a10" stroke-width="0.8" stroke-linecap="round" opacity="0.4"/>' +
      '<circle cx="20" cy="44" r="2.5" fill="#2a1a10"/>' +
      '</svg>';
  }

  var icons = {
    back: '<svg viewBox="0 0 24 24" fill="none"><path d="M15 5L8 12l7 7" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 8h3l2-2h6l2 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" stroke="' + stroke + '" stroke-width="' + sw + '"/></svg>',
    locate: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="' + stroke + '" stroke-width="' + sw + '"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none"><circle cx="6" cy="12" r="2.5" stroke="' + stroke + '" stroke-width="' + sw + '"/><circle cx="18" cy="6" r="2.5" stroke="' + stroke + '" stroke-width="' + sw + '"/><circle cx="18" cy="18" r="2.5" stroke="' + stroke + '" stroke-width="' + sw + '"/><path d="M8 11l8-4M8 13l8 4" stroke="' + stroke + '" stroke-width="' + sw + '"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20V8m0 0l-4 4m4-4l4 4M5 4h14" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/></svg>',

    // Tab bar
    log: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="' + stroke + '" stroke-width="' + sw + '"/><path d="M12 8v4l3 2" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="' + stroke + '" stroke-width="' + sw + '"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none"><path d="M8 6h12M8 12h12M8 18h12" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round"/><circle cx="4" cy="6" r="1.2" fill="' + stroke + '"/><circle cx="4" cy="12" r="1.2" fill="' + stroke + '"/><circle cx="4" cy="18" r="1.2" fill="' + stroke + '"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20V10M10 20V5M16 20v-7M22 20H2" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round"/></svg>',
    group: '<svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="9" r="3" stroke="' + stroke + '" stroke-width="' + sw + '"/><circle cx="17" cy="10" r="2.2" stroke="' + stroke + '" stroke-width="' + sw + '"/><path d="M3 19c1-3 4-4 6-4s5 1 6 4M15 19c.5-2 2-3 4-3s3.5 1 4 3" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round"/></svg>',

    arrowhead: arrowheadSvg(),
    arrowheadFilled: arrowheadSvg("#7a3a2a", "#2a1a10"),
  };

  global.AF = global.AF || {};
  global.AF.icons = icons;
  global.AF.arrowheadMarkerSvg = arrowheadMarkerSvg;
})(typeof window !== "undefined" ? window : global);
