/* App shell: mounts root, routes tabs, renders sheets + toast. */
(function (global) {
  "use strict";

  var I = global.AF.icons;
  var V = global.AF.views;

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "html") el.innerHTML = v;
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else if (k.indexOf("on") === 0 && typeof v === "function") {
          el.addEventListener(k.slice(2).toLowerCase(), v);
        } else {
          el.setAttribute(k, v);
        }
      }
    }
    var kids = Array.isArray(children) ? children : children == null ? [] : [children];
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) {
        for (var j = 0; j < c.length; j++) {
          var cc = c[j];
          if (cc == null || cc === false) continue;
          el.appendChild(typeof cc === "string" ? document.createTextNode(cc) : cc);
        }
      } else {
        el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      }
    }
    return el;
  }
  global.AF.h = h;

  function tabBar(state, store) {
    var tab = state.tab;
    var btn = function (key, label, icon) {
      return h("button", {
        class: tab === key ? "active" : "",
        onClick: function () { store.setTab(key); },
      }, [h("span", { html: icon }), h("span", null, label)]);
    };
    return h("div", { class: "tabbar" }, [
      btn("log", "Log", I.log),
      btn("map", "Map", I.map),
      btn("finds", "Finds", I.list),
      btn("analytics", "Stats", I.chart),
      btn("groups", "Groups", I.group),
    ]);
  }

  function renderSheet(state, store) {
    if (!state.sheet) return null;
    var body;
    switch (state.sheet.type) {
      case "findDetails":
        body = V.findDetail.renderSheet(state, store);
        break;
      case "createGroup":
        body = V.groups.renderCreateSheet(state, store);
        break;
      case "joinGroup":
        body = V.groups.renderJoinSheet(state, store);
        break;
      case "importResult":
        body = V.groups.renderImportResult(state, store);
        break;
      case "confirmDelete":
        body = renderConfirm(state, store);
        break;
      case "storageFull":
        body = renderStorageFull(state, store);
        break;
      default:
        return null;
    }
    return h("div", {
      class: "scrim",
      onClick: function (e) { if (e.target === e.currentTarget) store.closeSheet(); },
    }, [body]);
  }

  function renderConfirm(state, store) {
    var s = state.sheet;
    return h("div", { class: "sheet" }, [
      h("div", { class: "sheet-grab" }),
      h("div", { class: "sheet-header" }, [
        h("div", null, null),
        h("div", { class: "sheet-title" }, s.title || "Are you sure?"),
        h("button", { class: "sheet-close", onClick: function () { store.closeSheet(); }, html: I.close }),
      ]),
      h("p", { style: "color: var(--ink-2); font-size: 13px; margin: 0 0 12px;" }, s.message || ""),
      h("button", {
        class: "btn-primary",
        style: "background: var(--err);",
        onClick: function () { if (s.onConfirm) s.onConfirm(); store.closeSheet(); },
      }, s.confirmLabel || "Delete"),
      h("button", { class: "btn-secondary", onClick: function () { store.closeSheet(); } }, "Cancel"),
    ]);
  }

  function renderStorageFull(state, store) {
    return h("div", { class: "sheet" }, [
      h("div", { class: "sheet-grab" }),
      h("div", { class: "sheet-header" }, [
        h("div", null, null),
        h("div", { class: "sheet-title" }, "Storage is full"),
        h("button", { class: "sheet-close", onClick: function () { store.closeSheet(); }, html: I.close }),
      ]),
      h("p", { style: "color: var(--ink-2); font-size: 13px; margin: 0 0 12px;" },
        "Your browser's local storage is full. Export your group to a JSON file so you can archive older finds, then delete the photos you no longer need on the device."),
      h("button", {
        class: "btn-primary",
        onClick: function () { store.setTab("groups"); store.closeSheet(); },
      }, "Go to Groups"),
    ]);
  }

  function mount() {
    var root = document.getElementById("app");
    var store = global.AF.createStore();

    function paint() {
      var state = store.get();
      root.innerHTML = "";

      var view;
      switch (state.tab) {
        case "map":       view = V.map.render(state, store); break;
        case "finds":     view = V.finds.render(state, store); break;
        case "analytics": view = V.analytics.render(state, store); break;
        case "groups":    view = V.groups.render(state, store); break;
        case "log":
        default:          view = V.log.render(state, store); break;
      }
      root.appendChild(view);
      root.appendChild(tabBar(state, store));

      var sheet = renderSheet(state, store);
      if (sheet) root.appendChild(sheet);

      if (state.toast) {
        root.appendChild(h("div", { class: "toast" }, state.toast.msg));
      }
    }

    store.subscribe(paint);
    paint();

    global.__AF_STORE__ = store;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})(window);
