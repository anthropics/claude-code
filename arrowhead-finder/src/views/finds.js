/* View: Finds — reverse-chronological list of finds in the active group. */
(function (global) {
  "use strict";

  function h() { return global.AF.h.apply(null, arguments); }
  var I = global.AF.icons;

  function dateLabel(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function render(state, store) {
    var data = state.data;
    var activeGroup = data.activeGroupId ? data.groups[data.activeGroupId] : null;
    var finds = [];
    if (activeGroup) {
      var keys = Object.keys(data.finds);
      for (var i = 0; i < keys.length; i++) {
        var f = data.finds[keys[i]];
        if (f.groupId === activeGroup.id) finds.push(f);
      }
    }
    finds.sort(function (a, b) { return b.createdAt - a.createdAt; });

    var q = (state.findsFilter || "").toLowerCase().trim();
    var filtered = q ? finds.filter(function (f) {
      return (
        (f.type || "").toLowerCase().indexOf(q) !== -1 ||
        (f.material || "").toLowerCase().indexOf(q) !== -1 ||
        (f.notes || "").toLowerCase().indexOf(q) !== -1
      );
    }) : finds;

    var view = h("div", { class: "view" }, []);

    view.appendChild(h("div", { class: "appbar" }, [
      h("div", null, null),
      h("div", null, [
        h("div", { class: "title" }, "Finds"),
        h("div", { class: "sub" }, (activeGroup ? activeGroup.name + " · " : "") + finds.length + " total"),
      ]),
      h("div", null, null),
    ]));

    if (finds.length > 0) {
      view.appendChild(h("div", { class: "finds-search" }, [
        h("input", {
          type: "search",
          placeholder: "Search type, material, notes",
          value: state.findsFilter || "",
          oninput: function (e) { state.findsFilter = e.target.value; refreshList(); },
        }),
      ]));
    }

    var listWrap = h("div", { class: "finds-list" }, []);
    view.appendChild(listWrap);

    function refreshList() {
      var q2 = (state.findsFilter || "").toLowerCase().trim();
      var cur = q2 ? finds.filter(function (f) {
        return (
          (f.type || "").toLowerCase().indexOf(q2) !== -1 ||
          (f.material || "").toLowerCase().indexOf(q2) !== -1 ||
          (f.notes || "").toLowerCase().indexOf(q2) !== -1
        );
      }) : finds;
      listWrap.innerHTML = "";
      fillList(listWrap, cur, store);
    }

    fillList(listWrap, filtered, store);

    if (finds.length === 0) {
      view.appendChild(h("div", { class: "empty" }, [
        h("div", { class: "h" }, activeGroup ? "No finds yet" : "No active group"),
        h("div", { class: "b" }, activeGroup ? "Tap 'I Found One!' on the Log tab to log your first." : "Pick or create one on the Groups tab."),
      ]));
    }

    return view;
  }

  function fillList(listWrap, items, store) {
    items.forEach(function (f) {
      var coordsStr = f.coords ? (f.coords.lat.toFixed(4) + ", " + f.coords.lng.toFixed(4)) : "";
      var row = global.AF.h("div", {
        class: "finds-row",
        onClick: function () { store.openSheet({ type: "findDetails", findId: f.id }); },
      }, [
        global.AF.h("div", { class: "thumb small" },
          f.thumbDataUrl
            ? global.AF.h("img", { src: f.thumbDataUrl, alt: "" })
            : global.AF.h("span", { html: global.AF.icons.arrowhead, style: "width:28px;height:28px;display:inline-flex;" })
        ),
        global.AF.h("div", { class: "meta" }, [
          global.AF.h("div", { class: "t" }, f.type || "Unclassified"),
          global.AF.h("div", { class: "s" }, (f.material || "unknown") + (f.size && f.size.lengthMm ? " · " + Math.round(f.size.lengthMm) + " mm" : "") + (coordsStr ? " · " + coordsStr : "")),
        ]),
        global.AF.h("div", { class: "date" }, dateLabel(f.createdAt)),
      ]);
      listWrap.appendChild(row);
    });
  }

  global.AF = global.AF || {};
  global.AF.views = global.AF.views || {};
  global.AF.views.finds = { render: render };
})(window);
