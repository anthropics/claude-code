/* View: Groups — create/join, switch, export/import. */
(function (global) {
  "use strict";

  function h() { return global.AF.h.apply(null, arguments); }
  var I = global.AF.icons;

  function slugify(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "group";
  }

  function ymd(ts) {
    var d = new Date(ts);
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }

  function downloadBlob(data, filename) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  function countFindsInGroup(data, gid) {
    var n = 0;
    var keys = Object.keys(data.finds);
    for (var i = 0; i < keys.length; i++) if (data.finds[keys[i]].groupId === gid) n++;
    return n;
  }

  function render(state, store) {
    var data = state.data;
    var activeGroup = data.activeGroupId ? data.groups[data.activeGroupId] : null;
    var groupIds = Object.keys(data.groups);

    var view = h("div", { class: "view" }, []);

    view.appendChild(h("div", { class: "appbar" }, [
      h("div", null, null),
      h("div", null, [
        h("div", { class: "title" }, "Groups"),
        h("div", { class: "sub" }, groupIds.length + " total"),
      ]),
      h("div", null, null),
    ]));

    if (activeGroup) {
      var count = countFindsInGroup(data, activeGroup.id);
      view.appendChild(h("div", { class: "group-card active" }, [
        h("div", { class: "name" }, activeGroup.name),
        h("div", { class: "code" }, activeGroup.code),
        h("div", { class: "sub" }, count + (count === 1 ? " find" : " finds") + " on this device"),
        h("div", { class: "actions" }, [
          h("button", {
            class: "btn-secondary",
            style: "margin-top:0;",
            onClick: function () {
              var exportObj = store.exportGroup(activeGroup.id);
              var filename = slugify(activeGroup.name) + "-" + ymd(Date.now()) + ".json";
              downloadBlob(exportObj, filename);
              store.toast("Exported " + count + (count === 1 ? " find" : " finds"));
            },
          }, [h("span", { html: I.download, style: "width:16px;height:16px;display:inline-block;vertical-align:-3px;margin-right:6px;" }), "Export"]),
          h("button", {
            class: "btn-secondary",
            style: "margin-top:0;",
            onClick: function () {
              triggerImport(store);
            },
          }, [h("span", { html: I.upload, style: "width:16px;height:16px;display:inline-block;vertical-align:-3px;margin-right:6px;" }), "Import"]),
        ]),
      ]));
    } else {
      view.appendChild(h("div", { class: "empty" }, [
        h("div", { class: "h" }, "No active group"),
        h("div", { class: "b" }, "Create one or join an existing group by code."),
      ]));
    }

    view.appendChild(h("div", { class: "group-cta" }, [
      h("button", {
        class: "btn-primary",
        onClick: function () { store.openSheet({ type: "createGroup" }); },
      }, [h("span", { html: I.plus, style: "width:16px;height:16px;display:inline-block;vertical-align:-3px;margin-right:6px;" }), "Create Group"]),
      h("button", {
        class: "btn-secondary",
        onClick: function () { store.openSheet({ type: "joinGroup" }); },
      }, "Join Group by Code"),
    ]));

    if (groupIds.length > 1) {
      view.appendChild(h("div", { class: "section-title", style: "padding: 0 14px;" }, "Other Groups"));
      var others = groupIds
        .map(function (id) { return data.groups[id]; })
        .filter(function (g) { return !activeGroup || g.id !== activeGroup.id; })
        .sort(function (a, b) { return a.createdAt - b.createdAt; });
      others.forEach(function (g) {
        var count = countFindsInGroup(data, g.id);
        view.appendChild(h("div", {
          class: "group-row",
          onClick: function () {
            store.switchGroup(g.id);
            store.toast("Switched to " + g.name);
          },
        }, [
          h("div", null, [
            h("div", { class: "name" }, g.name),
            h("div", { class: "code" }, g.code),
          ]),
          h("div", { class: "count" }, count + (count === 1 ? " find" : " finds")),
        ]));
      });
    }

    view.appendChild(h("div", { style: "height: 20px;" }));

    return view;
  }

  function triggerImport(store) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.className = "sr-file";
    input.addEventListener("change", function () {
      var f = input.files && input.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var result = store.importGroup(reader.result);
          store.openSheet({ type: "importResult", result: result });
        } catch (e) {
          store.toast(humanizeImportErr(e));
        }
      };
      reader.onerror = function () { store.toast("Couldn't read file"); };
      reader.readAsText(f);
    });
    document.body.appendChild(input);
    input.click();
    setTimeout(function () { document.body.removeChild(input); }, 0);
  }

  function humanizeImportErr(e) {
    if (!e) return "Import failed";
    var msg = e.message || String(e);
    if (msg.indexOf("BAD_FORMAT") !== -1) return "That file isn't an Arrowhead Finder export.";
    if (msg.indexOf("BAD_SCHEMA") !== -1) return "That file is from a newer version.";
    if (msg.indexOf("BAD_GROUP") !== -1) return "The group data is missing from the file.";
    return "Import failed: " + msg;
  }

  function renderCreateSheet(state, store) {
    var name = "";
    var input = h("input", {
      type: "text",
      placeholder: "e.g. Creek Bottom Crew",
      autofocus: "autofocus",
      onInput: function (e) { name = e.target.value; },
    });
    return h("div", { class: "sheet" }, [
      h("div", { class: "sheet-grab" }),
      h("div", { class: "sheet-header" }, [
        h("div", null, null),
        h("div", { class: "sheet-title" }, "Create Group"),
        h("button", { class: "sheet-close", onClick: function () { store.closeSheet(); }, html: I.close }),
      ]),
      h("div", { class: "body" }, [
        h("p", { style: "color:var(--ink-2); font-size:13px; margin:0 0 4px;" },
          "Give your hunting group a name. You'll get a shareable group code that others can use to join."),
        h("div", { class: "field full" }, [
          h("label", null, "Group name"),
          input,
        ]),
        h("button", {
          class: "btn-primary",
          onClick: function () {
            if (!name.trim()) { store.toast("Enter a name"); return; }
            var g = store.createGroup({ name: name.trim() });
            store.closeSheet();
            store.toast("Group " + g.code + " created");
          },
        }, "Create Group"),
      ]),
    ]);
  }

  function renderJoinSheet(state, store) {
    var code = "";
    var name = "";
    var codeInput = h("input", {
      type: "text",
      placeholder: "e.g. FLINT-7QK",
      maxlength: "7",
      autocapitalize: "characters",
      oninput: function (e) {
        // Auto-insert the dash after 3 chars for ergonomics.
        var v = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
        if (v.length === 3 && code.length < 3) v += "-";
        e.target.value = v;
        code = v;
      },
    });
    var nameInput = h("input", {
      type: "text",
      placeholder: "Your name (optional)",
      oninput: function (e) { name = e.target.value; },
    });
    return h("div", { class: "sheet" }, [
      h("div", { class: "sheet-grab" }),
      h("div", { class: "sheet-header" }, [
        h("div", null, null),
        h("div", { class: "sheet-title" }, "Join Group"),
        h("button", { class: "sheet-close", onClick: function () { store.closeSheet(); }, html: I.close }),
      ]),
      h("div", { class: "body" }, [
        h("p", { style: "color:var(--ink-2); font-size:13px; margin:0 0 4px;" },
          "Enter the group code your group shared with you. Then import their export file to bring in existing finds."),
        h("div", { class: "field full" }, [
          h("label", null, "Group code"),
          codeInput,
        ]),
        h("div", { class: "field full" }, [
          h("label", null, "Your display name"),
          nameInput,
        ]),
        h("button", {
          class: "btn-primary",
          onClick: function () {
            try {
              var g = store.joinGroup({ code: code, name: name });
              store.closeSheet();
              store.toast("Joined " + g.code);
            } catch (e) {
              if (e.message === "INVALID_CODE") store.toast("Code must look like ABC-4XY");
              else store.toast("Couldn't join: " + e.message);
            }
          },
        }, "Join Group"),
      ]),
    ]);
  }

  function renderImportResult(state, store) {
    var r = state.sheet.result || { added: 0, updated: 0, skipped: 0 };
    return h("div", { class: "sheet" }, [
      h("div", { class: "sheet-grab" }),
      h("div", { class: "sheet-header" }, [
        h("div", null, null),
        h("div", { class: "sheet-title" }, "Import Complete"),
        h("button", { class: "sheet-close", onClick: function () { store.closeSheet(); }, html: I.close }),
      ]),
      h("div", { class: "body" }, [
        h("div", { class: "kpi-grid" }, [
          h("div", { class: "kpi-card" }, [h("div", { class: "label" }, "Added"), h("div", { class: "value" }, String(r.added))]),
          h("div", { class: "kpi-card" }, [h("div", { class: "label" }, "Updated"), h("div", { class: "value" }, String(r.updated))]),
        ]),
        h("div", { class: "kpi-grid" }, [
          h("div", { class: "kpi-card" }, [h("div", { class: "label" }, "Skipped"), h("div", { class: "value" }, String(r.skipped)), h("div", { class: "sub" }, "already up to date")]),
          h("div", { class: "kpi-card" }, [h("div", { class: "label" }, "Total"), h("div", { class: "value" }, String(r.added + r.updated + r.skipped))]),
        ]),
        h("button", { class: "btn-primary", onClick: function () { store.closeSheet(); } }, "Done"),
      ]),
    ]);
  }

  global.AF = global.AF || {};
  global.AF.views = global.AF.views || {};
  global.AF.views.groups = {
    render: render,
    renderCreateSheet: renderCreateSheet,
    renderJoinSheet: renderJoinSheet,
    renderImportResult: renderImportResult,
  };
})(window);
