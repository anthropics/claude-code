/* View: Find Detail — edit a single find (type, material, size, photo, notes). */
(function (global) {
  "use strict";

  function h() { return global.AF.h.apply(null, arguments); }
  var I = global.AF.icons;

  function optionEl(value, label, selected) {
    var attrs = { value: value };
    if (selected) attrs.selected = "selected";
    return h("option", attrs, label);
  }

  // Map between mm and inches for the size inputs.
  function mmToInches(mm) { return mm == null ? "" : (mm / 25.4).toFixed(2).replace(/\.?0+$/, ""); }
  function inchesToMm(inches) {
    var n = parseFloat(inches);
    return isFinite(n) ? Math.round(n * 25.4 * 10) / 10 : null;
  }

  function renderSheet(state, store) {
    var findId = state.sheet.findId;
    var justCreated = !!state.sheet.justCreated;
    var find = state.data.finds[findId];
    if (!find) {
      return h("div", { class: "sheet" }, [
        h("div", { class: "sheet-grab" }),
        h("p", null, "Find not found."),
      ]);
    }

    // Draft held locally on the sheet node so input edits don't trigger
    // a full re-render until Save. Keeps typing smooth.
    var draft = {
      type: find.type || "",
      material: find.material || "",
      condition: find.condition || "",
      lengthMm: find.size && find.size.lengthMm != null ? find.size.lengthMm : null,
      widthMm: find.size && find.size.widthMm != null ? find.size.widthMm : null,
      unit: "mm",
      notes: find.notes || "",
      finderName: find.finderName || "",
      photoDataUrl: find.photoDataUrl || null,
      thumbDataUrl: find.thumbDataUrl || null,
    };

    var sheet = h("div", { class: "sheet" }, []);
    sheet.appendChild(h("div", { class: "sheet-grab" }));
    sheet.appendChild(h("div", { class: "sheet-header" }, [
      h("div", null, null),
      h("div", { class: "sheet-title" }, justCreated ? "New Find" : "Edit Find"),
      h("button", { class: "sheet-close", onClick: function () { store.closeSheet(); }, html: I.close }),
    ]));

    var body = h("div", { class: "body" }, []);
    sheet.appendChild(body);

    // Photo area
    var photoBox = h("div", { class: "detail-photo" }, []);
    function paintPhoto() {
      photoBox.innerHTML = "";
      if (draft.photoDataUrl) {
        photoBox.appendChild(h("img", { src: draft.photoDataUrl, alt: "Find photo" }));
        photoBox.appendChild(h("span", { class: "photo-cta" }, [h("span", { html: I.camera }), "Replace"]));
      } else {
        photoBox.appendChild(h("span", { class: "photo-cta" }, [h("span", { html: I.camera }), "Add photo"]));
      }
    }
    paintPhoto();

    var fileInput = h("input", {
      type: "file",
      accept: "image/*",
      capture: "environment",
      class: "sr-file",
      onChange: function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        photoBox.innerHTML = "";
        photoBox.appendChild(h("div", { style: "font-size:11px; color:var(--ink-3);" }, "Processing..."));
        global.AF.photo.processFile(f).then(function (out) {
          draft.photoDataUrl = out.photoDataUrl;
          draft.thumbDataUrl = out.thumbDataUrl;
          paintPhoto();
        }).catch(function () {
          paintPhoto();
          store.toast("Couldn't load photo");
        });
      },
    });
    photoBox.addEventListener("click", function () { fileInput.click(); });
    body.appendChild(photoBox);
    body.appendChild(fileInput);

    // Coords card
    if (find.coords) {
      body.appendChild(h("div", { class: "coords-card" }, [
        h("div", null, [
          h("div", { class: "lat-lng" }, find.coords.lat.toFixed(5) + ", " + find.coords.lng.toFixed(5)),
          find.coords.accuracy != null ? h("div", { class: "acc" }, "±" + Math.round(find.coords.accuracy) + "m accuracy") : null,
        ]),
        h("div", { style: "font-size:10px; color:var(--ink-3); text-align:right;" }, "GPS"),
      ]));
    }

    // Type / Material / Condition
    var typeOpts = [h("option", { value: "" }, "Pick a type")];
    global.AF.TYPES.forEach(function (t) { typeOpts.push(optionEl(t, t, draft.type === t)); });

    var matOpts = [h("option", { value: "" }, "Pick a material")];
    global.AF.MATERIALS.forEach(function (m) { matOpts.push(optionEl(m, m, draft.material === m)); });

    var condOpts = [h("option", { value: "" }, "Pick a condition")];
    global.AF.CONDITIONS.forEach(function (c) { condOpts.push(optionEl(c, c, draft.condition === c)); });

    body.appendChild(h("div", { class: "field-grid" }, [
      h("div", { class: "field" }, [
        h("label", null, "Type"),
        h("select", { onChange: function (e) { draft.type = e.target.value; } }, typeOpts),
      ]),
      h("div", { class: "field" }, [
        h("label", null, "Material"),
        h("select", { onChange: function (e) { draft.material = e.target.value; } }, matOpts),
      ]),
      h("div", { class: "field full" }, [
        h("label", null, "Condition"),
        h("select", { onChange: function (e) { draft.condition = e.target.value; } }, condOpts),
      ]),
    ]));

    // Size row with unit toggle
    var lenInput = h("input", {
      type: "number",
      step: "0.1",
      placeholder: "Length",
      value: draft.lengthMm != null ? String(draft.lengthMm) : "",
      inputmode: "decimal",
      onInput: function (e) {
        var val = e.target.value;
        if (draft.unit === "mm") {
          draft.lengthMm = val === "" ? null : parseFloat(val);
        } else {
          draft.lengthMm = val === "" ? null : inchesToMm(val);
        }
      },
    });
    var widthInput = h("input", {
      type: "number",
      step: "0.1",
      placeholder: "Width",
      value: draft.widthMm != null ? String(draft.widthMm) : "",
      inputmode: "decimal",
      onInput: function (e) {
        var val = e.target.value;
        if (draft.unit === "mm") {
          draft.widthMm = val === "" ? null : parseFloat(val);
        } else {
          draft.widthMm = val === "" ? null : inchesToMm(val);
        }
      },
    });
    var mmBtn, inBtn;
    mmBtn = h("button", {
      class: "active",
      type: "button",
      onClick: function () {
        if (draft.unit === "mm") return;
        draft.unit = "mm";
        mmBtn.classList.add("active"); inBtn.classList.remove("active");
        lenInput.value = draft.lengthMm != null ? String(draft.lengthMm) : "";
        widthInput.value = draft.widthMm != null ? String(draft.widthMm) : "";
      },
    }, "mm");
    inBtn = h("button", {
      type: "button",
      onClick: function () {
        if (draft.unit === "in") return;
        draft.unit = "in";
        inBtn.classList.add("active"); mmBtn.classList.remove("active");
        lenInput.value = draft.lengthMm != null ? mmToInches(draft.lengthMm) : "";
        widthInput.value = draft.widthMm != null ? mmToInches(draft.widthMm) : "";
      },
    }, "in");

    body.appendChild(h("div", { class: "field full" }, [
      h("label", null, "Size"),
      h("div", { class: "size-row" }, [
        lenInput,
        widthInput,
        h("div", { class: "unit-toggle" }, [mmBtn, inBtn]),
      ]),
    ]));

    // Notes
    body.appendChild(h("div", { class: "field full" }, [
      h("label", null, "Notes"),
      h("textarea", {
        rows: "3",
        placeholder: "Anything worth remembering?",
        onInput: function (e) { draft.notes = e.target.value; },
      }, draft.notes),
    ]));

    // Finder name
    body.appendChild(h("div", { class: "field full" }, [
      h("label", null, "Finder (who picked it up)"),
      h("input", {
        type: "text",
        placeholder: "Your name",
        value: draft.finderName,
        onInput: function (e) { draft.finderName = e.target.value; },
      }),
    ]));

    // Save + Delete
    body.appendChild(h("button", {
      class: "btn-primary",
      onClick: function () {
        var patch = {
          type: draft.type,
          material: draft.material,
          condition: draft.condition,
          notes: draft.notes,
          finderName: draft.finderName,
          photoDataUrl: draft.photoDataUrl,
          thumbDataUrl: draft.thumbDataUrl,
          size: (draft.lengthMm != null || draft.widthMm != null)
            ? { lengthMm: draft.lengthMm, widthMm: draft.widthMm }
            : null,
        };
        try {
          store.updateFind(findId, patch);
          store.closeSheet();
          store.toast("Find saved");
        } catch (e) {
          store.toast("Couldn't save: " + (e.message || e));
        }
      },
    }, "Save Find"));

    body.appendChild(h("button", {
      class: "btn-danger",
      onClick: function () {
        store.openSheet({
          type: "confirmDelete",
          title: "Delete this find?",
          message: "This can't be undone. The GPS coordinates, photo and notes will be removed.",
          confirmLabel: "Delete find",
          onConfirm: function () {
            store.deleteFind(findId);
            store.toast("Find deleted");
          },
        });
      },
    }, "Delete Find"));

    return sheet;
  }

  global.AF = global.AF || {};
  global.AF.views = global.AF.views || {};
  global.AF.views.findDetail = { renderSheet: renderSheet };
})(window);
