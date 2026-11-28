/* View: Log — "I Found One!" primary CTA and recent-finds strip. */
(function (global) {
  "use strict";

  function h() { return global.AF.h.apply(null, arguments); }
  var I = global.AF.icons;

  function relTime(ts) {
    if (!ts) return "";
    var diff = Math.max(0, Date.now() - ts);
    var s = Math.floor(diff / 1000);
    if (s < 60) return "just now";
    var m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    var hr = Math.floor(m / 60);
    if (hr < 24) return hr + "h ago";
    var d = Math.floor(hr / 24);
    if (d < 7) return d + "d ago";
    var w = Math.floor(d / 7);
    if (w < 5) return w + "w ago";
    var mo = Math.floor(d / 30);
    if (mo < 12) return mo + "mo ago";
    return Math.floor(d / 365) + "y ago";
  }

  function recentRow(find, store) {
    var typeLabel = find.type || "Unclassified";
    var matLabel = find.material || "unknown material";
    return h("div", {
      class: "recent-row",
      onClick: function () {
        store.selectFind(find.id);
        store.openSheet({ type: "findDetails", findId: find.id });
      },
    }, [
      h("div", { class: "thumb" },
        find.thumbDataUrl
          ? h("img", { src: find.thumbDataUrl, alt: "" })
          : h("span", { html: I.arrowhead, style: "width:24px;height:24px;display:inline-flex;" })
      ),
      h("div", { class: "meta" }, [
        h("div", { class: "t" }, typeLabel),
        h("div", { class: "s" }, matLabel + (find.size && find.size.lengthMm ? " · " + Math.round(find.size.lengthMm) + " mm" : "")),
      ]),
      h("div", { class: "ago" }, relTime(find.createdAt)),
    ]);
  }

  function render(state, store) {
    var data = state.data;
    var activeGroup = data.activeGroupId ? data.groups[data.activeGroupId] : null;
    var findsInGroup = activeGroup
      ? Object.keys(data.finds).map(function (k) { return data.finds[k]; }).filter(function (f) { return f.groupId === activeGroup.id; })
      : [];
    findsInGroup.sort(function (a, b) { return b.createdAt - a.createdAt; });

    var view = h("div", { class: "view" }, []);

    view.appendChild(h("div", { class: "appbar" }, [
      h("div", null, null),
      h("div", null, [
        h("div", { class: "title" }, "Arrowhead Finder"),
        h("div", { class: "sub" }, "Log a Find"),
      ]),
      h("div", null, null),
    ]));

    view.appendChild(h("div", { class: "log-hero" }, [
      activeGroup
        ? h("div", { class: "group-chip" }, [
            h("span", { class: "dot" }),
            activeGroup.name + " · " + activeGroup.code,
          ])
        : h("div", { class: "group-chip" }, [h("span", { class: "dot", style: "background: var(--ink-3);" }), "No active group"]),
      h("p", { class: "log-tagline" },
        activeGroup
          ? "Tap below when you find one. We'll capture GPS and let you add photo, size and type."
          : "Create or join a group first so your finds have somewhere to live."),
    ]));

    var busy = state.sheet && state.sheet.type === "capturing";
    var btn = h("button", {
      class: "find-btn" + (busy ? " busy" : ""),
      disabled: !activeGroup || busy ? "disabled" : null,
      onClick: function () {
        if (!activeGroup) { store.setTab("groups"); return; }
        captureAndOpen(store);
      },
    }, [
      h("span", { class: "icon", html: I.arrowheadFilled }),
      h("span", null, busy ? "Getting GPS..." : "I Found One!"),
    ]);
    view.appendChild(btn);

    var msg = state.toast ? "" : "";
    view.appendChild(h("div", { class: "log-status", id: "log-status" }, ""));

    view.appendChild(h("div", { class: "recent-finds" }, [
      h("div", { class: "section-title" }, "Recent Finds"),
      findsInGroup.length === 0
        ? h("div", { class: "empty" }, [
            h("div", { class: "h" }, "No finds yet"),
            h("div", { class: "b" }, activeGroup ? "Tap the big button above." : "Join a group to start logging."),
          ])
        : h("div", null, findsInGroup.slice(0, 6).map(function (f) { return recentRow(f, store); })),
    ]));

    return view;
  }

  function captureAndOpen(store) {
    var statusEl = document.getElementById("log-status");
    if (statusEl) { statusEl.textContent = "Getting GPS..."; statusEl.classList.remove("err"); }
    global.AF.geo.capturePosition({ timeout: 15000 })
      .then(function (pos) {
        // Create a draft find immediately so the sheet can edit it.
        try {
          var draft = store.createFind({
            coords: { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy },
          });
          if (statusEl) statusEl.textContent = "";
          store.openSheet({ type: "findDetails", findId: draft.id, justCreated: true });
        } catch (e) {
          if (statusEl) { statusEl.textContent = humanizeErr(e); statusEl.classList.add("err"); }
        }
      })
      .catch(function (err) {
        if (statusEl) { statusEl.textContent = humanizeErr(err); statusEl.classList.add("err"); }
      });
  }

  function humanizeErr(err) {
    if (!err) return "Something went wrong.";
    switch (err.code || err.message) {
      case "PERMISSION_DENIED": return "Location blocked — enable location for this site in your browser settings.";
      case "UNAVAILABLE": return "GPS unavailable right now. Try again outdoors with a clear sky view.";
      case "TIMEOUT": return "Timed out waiting for GPS. Try again.";
      case "NO_ACTIVE_GROUP": return "No active group. Pick or create one on the Groups tab.";
      case "MISSING_COORDS": return "No coordinates captured.";
      default: return err.message || "Something went wrong.";
    }
  }

  global.AF = global.AF || {};
  global.AF.views = global.AF.views || {};
  global.AF.views.log = { render: render, relTime: relTime };
})(window);
