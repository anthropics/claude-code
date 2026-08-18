/* View: Map — Leaflet map with arrowhead-SVG markers for each find. */
(function (global) {
  "use strict";

  function h() { return global.AF.h.apply(null, arguments); }
  var I = global.AF.icons;

  var MAP_FILTERS = [
    { id: "all", label: "All" },
    { id: "Clovis", label: "Clovis" },
    { id: "Folsom", label: "Folsom" },
    { id: "Archaic", label: "Archaic" },
    { id: "Woodland", label: "Woodland" },
    { id: "Other", label: "Other" },
  ];

  // Module-local map state so re-renders don't rebuild Leaflet from scratch.
  var mapState = {
    leaflet: null,
    markers: {},
    tileLayer: null,
    activeFilter: "all",
    lastMarkerIds: "",
  };

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function makeIcon() {
    return L.divIcon({
      className: "arrow-marker",
      html: global.AF.arrowheadMarkerSvg("#7a3a2a"),
      iconSize: [40, 48],
      iconAnchor: [20, 46],
      popupAnchor: [0, -42],
    });
  }

  function popupHtml(f) {
    var dateStr = new Date(f.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    var thumb = f.thumbDataUrl
      ? '<div class="thumb"><img src="' + f.thumbDataUrl + '" alt=""/></div>'
      : '<div class="thumb">' + I.arrowhead + "</div>";
    var accStr = f.coords && f.coords.accuracy != null ? " · ±" + Math.round(f.coords.accuracy) + "m" : "";
    return '<div class="popup-find">' + thumb +
      '<div>' +
      '<div class="t">' + escapeHtml(f.type || "Unclassified") + '</div>' +
      '<div class="s">' + escapeHtml(f.material || "unknown") + accStr + '</div>' +
      '<div class="s">' + escapeHtml(dateStr) + '</div>' +
      '<div class="open" data-find-id="' + f.id + '">Open details ›</div>' +
      '</div></div>';
  }

  function matchFilter(find, filter) {
    if (filter === "all") return true;
    var t = find.type || "";
    if (filter === "Archaic") return t.indexOf("Archaic") === 0;
    if (filter === "Woodland") return t.indexOf("Woodland") === 0 || t.indexOf("Mississippian") === 0;
    if (filter === "Other") return !t || t === "Other" || t === "Dalton";
    return t === filter;
  }

  function ensureMap(container) {
    if (mapState.leaflet) return mapState.leaflet;
    var map = L.map(container, { scrollWheelZoom: true, zoomControl: false }).setView([39.5, -98.35], 4);
    mapState.tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    mapState.leaflet = map;
    return map;
  }

  function syncMarkers(map, finds, store) {
    var ids = finds.map(function (f) { return f.id; }).sort().join(",");
    // Always refresh since data can change in-place (photos added etc.).
    Object.keys(mapState.markers).forEach(function (id) {
      map.removeLayer(mapState.markers[id]);
    });
    mapState.markers = {};

    finds.forEach(function (f) {
      if (!f.coords || typeof f.coords.lat !== "number") return;
      var m = L.marker([f.coords.lat, f.coords.lng], { icon: makeIcon() });
      m.bindPopup(popupHtml(f));
      m.on("popupopen", function (e) {
        var node = e.popup.getElement();
        if (!node) return;
        var link = node.querySelector("[data-find-id]");
        if (link) {
          link.style.cursor = "pointer";
          link.addEventListener("click", function () {
            store.openSheet({ type: "findDetails", findId: f.id });
          });
        }
      });
      m.addTo(map);
      mapState.markers[f.id] = m;
    });

    if (ids !== mapState.lastMarkerIds && finds.length > 0) {
      var group = L.featureGroup(Object.keys(mapState.markers).map(function (k) { return mapState.markers[k]; }));
      try { map.fitBounds(group.getBounds().pad(0.25), { maxZoom: 15 }); } catch (_) {}
    }
    mapState.lastMarkerIds = ids;
  }

  function render(state, store) {
    var data = state.data;
    var activeGroup = data.activeGroupId ? data.groups[data.activeGroupId] : null;

    var wrap = h("div", { class: "view", style: "display:flex; flex-direction:column;" }, []);

    wrap.appendChild(h("div", { class: "appbar" }, [
      h("div", null, null),
      h("div", null, [
        h("div", { class: "title" }, "Map"),
        h("div", { class: "sub" }, activeGroup ? activeGroup.name : "No active group"),
      ]),
      h("div", null, null),
    ]));

    var mapWrap = h("div", { class: "map-wrap" }, []);
    var mapEl = h("div", { id: "map" });
    mapWrap.appendChild(mapEl);

    // Filter chips
    var filterBar = h("div", { class: "map-filters" },
      MAP_FILTERS.map(function (fl) {
        return h("button", {
          class: "filter-chip" + (mapState.activeFilter === fl.id ? " active" : ""),
          onClick: function () {
            mapState.activeFilter = fl.id;
            // Re-render just the marker layer rather than the whole view.
            var finds = getFilteredFinds(data, activeGroup, fl.id);
            if (mapState.leaflet) syncMarkers(mapState.leaflet, finds, store);
            // And update chip UI
            var chips = filterBar.querySelectorAll(".filter-chip");
            chips.forEach(function (c) { c.classList.remove("active"); });
            chips[MAP_FILTERS.indexOf(fl)].classList.add("active");
          },
        }, fl.label);
      })
    );
    mapWrap.appendChild(filterBar);

    // Locate-me button
    mapWrap.appendChild(h("button", {
      class: "map-locate",
      onClick: function () {
        if (!mapState.leaflet) return;
        mapState.leaflet.locate({ setView: true, maxZoom: 15, timeout: 10000 });
      },
      html: I.locate,
      "aria-label": "Locate me",
    }));

    wrap.appendChild(mapWrap);

    var finds = getFilteredFinds(data, activeGroup, mapState.activeFilter);
    if (!activeGroup) {
      mapWrap.appendChild(h("div", { class: "map-empty" }, [
        h("div", null, [h("strong", null, "No active group"), "Create or join one on the Groups tab."]),
      ]));
    } else if (finds.length === 0) {
      mapWrap.appendChild(h("div", { class: "map-empty" }, [
        h("div", null, [h("strong", null, "No finds yet"), "Tap 'I Found One!' on the Log tab to start."]),
      ]));
    }

    // Defer map creation to after the element is in the DOM.
    setTimeout(function () {
      var map = ensureMap(mapEl);
      syncMarkers(map, finds, store);
      map.invalidateSize();
    }, 0);

    return wrap;
  }

  function getFilteredFinds(data, activeGroup, filter) {
    if (!activeGroup) return [];
    var out = [];
    var keys = Object.keys(data.finds);
    for (var i = 0; i < keys.length; i++) {
      var f = data.finds[keys[i]];
      if (f.groupId === activeGroup.id && matchFilter(f, filter)) out.push(f);
    }
    return out;
  }

  global.AF = global.AF || {};
  global.AF.views = global.AF.views || {};
  global.AF.views.map = { render: render };
})(window);
