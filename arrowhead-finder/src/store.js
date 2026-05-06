/* ---------- Store ----------
 * State + reducer for groups and finds. Persists to localStorage under a
 * versioned key. Exposes CRUD plus group export/import (the "sync" story for
 * a backend-less static app — users hand a JSON file to their group).
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "arrowhead.v1";
  var SCHEMA_VERSION = 1;
  var EXPORT_FORMAT = "arrowhead-finder/group-export";

  var TYPES = [
    "Clovis",
    "Folsom",
    "Dalton",
    "Archaic Stemmed",
    "Archaic Notched",
    "Woodland Triangular",
    "Mississippian Triangular",
    "Other",
  ];

  var MATERIALS = [
    "chert",
    "flint",
    "obsidian",
    "jasper",
    "quartzite",
    "quartz",
    "other",
  ];

  var CONDITIONS = ["intact", "chipped", "tip broken", "base broken", "fragment"];

  // --- Id generation --------------------------------------------------------
  function uuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    // RFC4122-ish fallback
    var rnd = function () { return Math.floor(Math.random() * 0x10000).toString(16); };
    return rnd() + rnd() + "-" + rnd() + "-" + rnd() + "-" + rnd() + "-" + rnd() + rnd() + rnd();
  }

  function findId() { return "fnd_" + uuid(); }
  function groupId() { return "grp_" + uuid(); }

  // --- Group code generator -------------------------------------------------
  // Format: CCC-DCC  (3 consonants, dash, digit, 2 consonants). ~20M permutations.
  var CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ";
  function randCode() {
    var c = function () { return CONSONANTS.charAt(Math.floor(Math.random() * CONSONANTS.length)); };
    var d = function () { return String(Math.floor(Math.random() * 10)); };
    return c() + c() + c() + "-" + d() + c() + c();
  }
  function uniqueGroupCode(existingCodes) {
    var taken = {};
    for (var i = 0; i < existingCodes.length; i++) taken[existingCodes[i]] = true;
    for (var tries = 0; tries < 50; tries++) {
      var code = randCode();
      if (!taken[code]) return code;
    }
    return randCode();
  }

  // --- Persistence ----------------------------------------------------------
  function freshState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      activeGroupId: null,
      groups: {},
      finds: {},
    };
  }

  function load() {
    try {
      var raw = (typeof localStorage !== "undefined") && localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.schemaVersion === SCHEMA_VERSION) return parsed;
      }
    } catch (_) {}
    return freshState();
  }

  function save(state) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch (e) {
      // Surface via thrown error; view layer catches QuotaExceededError.
      throw e;
    }
  }

  // --- Find / Group reducers ------------------------------------------------
  function createFind(state, partial) {
    if (!state.activeGroupId) throw new Error("NO_ACTIVE_GROUP");
    if (!partial || !partial.coords || typeof partial.coords.lat !== "number") {
      throw new Error("MISSING_COORDS");
    }
    var now = Date.now();
    var find = {
      id: findId(),
      groupId: state.activeGroupId,
      createdAt: now,
      updatedAt: now,
      finderName: partial.finderName || "",
      coords: {
        lat: partial.coords.lat,
        lng: partial.coords.lng,
        accuracy: partial.coords.accuracy != null ? partial.coords.accuracy : null,
      },
      type: partial.type || "",
      material: partial.material || "",
      size: partial.size || null,
      condition: partial.condition || "",
      notes: partial.notes || "",
      photoDataUrl: partial.photoDataUrl || null,
      thumbDataUrl: partial.thumbDataUrl || null,
    };
    var next = assign({}, state);
    next.finds = assign({}, state.finds);
    next.finds[find.id] = find;
    return { state: next, find: find };
  }

  function updateFind(state, id, patch) {
    var existing = state.finds[id];
    if (!existing) throw new Error("FIND_NOT_FOUND");
    var updated = assign({}, existing, patch || {});
    updated.updatedAt = Date.now();
    var next = assign({}, state);
    next.finds = assign({}, state.finds);
    next.finds[id] = updated;
    return { state: next, find: updated };
  }

  function deleteFind(state, id) {
    var next = assign({}, state);
    next.finds = assign({}, state.finds);
    delete next.finds[id];
    return { state: next };
  }

  function createGroup(state, opts) {
    var name = (opts && opts.name && String(opts.name).trim()) || "My Group";
    var existingCodes = Object.keys(state.groups).map(function (k) { return state.groups[k].code; });
    var group = {
      id: groupId(),
      code: uniqueGroupCode(existingCodes),
      name: name,
      createdAt: Date.now(),
      members: (opts && Array.isArray(opts.members)) ? opts.members.slice() : [],
    };
    var next = assign({}, state);
    next.groups = assign({}, state.groups);
    next.groups[group.id] = group;
    next.activeGroupId = group.id;
    return { state: next, group: group };
  }

  function findGroupByCode(state, code) {
    var norm = String(code || "").trim().toUpperCase();
    var keys = Object.keys(state.groups);
    for (var i = 0; i < keys.length; i++) {
      if (state.groups[keys[i]].code === norm) return state.groups[keys[i]];
    }
    return null;
  }

  function joinGroup(state, opts) {
    var code = String((opts && opts.code) || "").trim().toUpperCase();
    if (!/^[A-Z]{3}-\d[A-Z]{2}$/.test(code)) throw new Error("INVALID_CODE");
    var existing = findGroupByCode(state, code);
    var next = assign({}, state);
    if (existing) {
      next.activeGroupId = existing.id;
      return { state: next, group: existing };
    }
    // Placeholder group — a subsequent import with the same code will merge.
    var group = {
      id: groupId(),
      code: code,
      name: (opts && opts.name && String(opts.name).trim()) || code,
      createdAt: Date.now(),
      members: [],
    };
    next.groups = assign({}, state.groups);
    next.groups[group.id] = group;
    next.activeGroupId = group.id;
    return { state: next, group: group };
  }

  function switchGroup(state, id) {
    if (!state.groups[id]) throw new Error("GROUP_NOT_FOUND");
    var next = assign({}, state);
    next.activeGroupId = id;
    return { state: next };
  }

  function deleteGroup(state, id) {
    if (!state.groups[id]) return { state: state };
    var next = assign({}, state);
    next.groups = assign({}, state.groups);
    delete next.groups[id];
    next.finds = {};
    var findKeys = Object.keys(state.finds);
    for (var i = 0; i < findKeys.length; i++) {
      var f = state.finds[findKeys[i]];
      if (f.groupId !== id) next.finds[f.id] = f;
    }
    if (next.activeGroupId === id) {
      var remaining = Object.keys(next.groups);
      next.activeGroupId = remaining.length ? remaining[0] : null;
    }
    return { state: next };
  }

  // --- Export / Import ------------------------------------------------------
  function exportGroup(state, gid) {
    var group = state.groups[gid];
    if (!group) throw new Error("GROUP_NOT_FOUND");
    var finds = [];
    var keys = Object.keys(state.finds);
    for (var i = 0; i < keys.length; i++) {
      var f = state.finds[keys[i]];
      if (f.groupId === gid) finds.push(f);
    }
    return {
      format: EXPORT_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: Date.now(),
      group: {
        id: group.id,
        code: group.code,
        name: group.name,
        createdAt: group.createdAt,
        members: group.members.slice(),
      },
      finds: finds,
    };
  }

  function importGroup(state, input) {
    var obj = typeof input === "string" ? JSON.parse(input) : input;
    if (!obj || obj.format !== EXPORT_FORMAT) throw new Error("BAD_FORMAT");
    if (obj.schemaVersion !== SCHEMA_VERSION) throw new Error("BAD_SCHEMA");
    if (!obj.group || !obj.group.code) throw new Error("BAD_GROUP");

    var next = assign({}, state);
    next.groups = assign({}, state.groups);
    next.finds = assign({}, state.finds);

    // Upsert group by code (preserve local id if we already have one with that code).
    var local = findGroupByCode(state, obj.group.code);
    var targetGroupId;
    if (local) {
      targetGroupId = local.id;
      var mergedMembers = local.members.slice();
      for (var m = 0; m < obj.group.members.length; m++) {
        if (mergedMembers.indexOf(obj.group.members[m]) === -1) {
          mergedMembers.push(obj.group.members[m]);
        }
      }
      next.groups[local.id] = assign({}, local, {
        name: obj.group.name || local.name,
        members: mergedMembers,
      });
    } else {
      targetGroupId = obj.group.id || groupId();
      next.groups[targetGroupId] = {
        id: targetGroupId,
        code: obj.group.code,
        name: obj.group.name || obj.group.code,
        createdAt: obj.group.createdAt || Date.now(),
        members: (obj.group.members || []).slice(),
      };
    }

    var added = 0, updated = 0, skipped = 0;
    for (var i = 0; i < obj.finds.length; i++) {
      var incoming = obj.finds[i];
      if (!incoming || !incoming.id) continue;
      var rewritten = assign({}, incoming, { groupId: targetGroupId });
      var existing = next.finds[incoming.id];
      if (!existing) {
        next.finds[incoming.id] = rewritten;
        added++;
      } else if ((incoming.updatedAt || 0) > (existing.updatedAt || 0)) {
        next.finds[incoming.id] = rewritten;
        updated++;
      } else {
        skipped++;
      }
    }

    if (!next.activeGroupId) next.activeGroupId = targetGroupId;

    return {
      state: next,
      result: { added: added, updated: updated, skipped: skipped, groupId: targetGroupId },
    };
  }

  // --- Helpers --------------------------------------------------------------
  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (!src) continue;
      for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
    }
    return target;
  }

  function findsForGroup(state, gid) {
    var out = [];
    var keys = Object.keys(state.finds);
    for (var i = 0; i < keys.length; i++) {
      var f = state.finds[keys[i]];
      if (f.groupId === gid) out.push(f);
    }
    return out;
  }

  // --- Store shell (UI state wrapper, subscribe/emit) -----------------------
  function createStore() {
    var uiState = {
      tab: "log",
      sheet: null,
      toast: null,
      selectedFindId: null,
      data: load(),
    };
    var subs = [];

    function emit() {
      try { save(uiState.data); } catch (e) {
        if (e && e.name === "QuotaExceededError") {
          uiState = assign({}, uiState, { sheet: { type: "storageFull" } });
        }
      }
      for (var i = 0; i < subs.length; i++) subs[i](uiState);
    }

    function setUi(patch) {
      uiState = assign({}, uiState, patch);
      emit();
    }

    function patchData(fn) {
      var res = fn(uiState.data);
      uiState = assign({}, uiState, { data: res });
      emit();
    }

    function toast(msg, ms) {
      uiState = assign({}, uiState, { toast: { msg: msg, ts: Date.now() } });
      emit();
      var duration = typeof ms === "number" ? ms : 1800;
      setTimeout(function () {
        uiState = assign({}, uiState, { toast: null });
        emit();
      }, duration);
    }

    return {
      get: function () { return uiState; },
      subscribe: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (s) { return s !== fn; }); }; },
      setTab: function (tab) { setUi({ tab: tab, sheet: null }); },
      openSheet: function (sheet) { setUi({ sheet: sheet }); },
      closeSheet: function () { setUi({ sheet: null }); },
      selectFind: function (id) { setUi({ selectedFindId: id }); },
      toast: toast,

      createFind: function (partial) {
        var res;
        patchData(function (s) { var r = createFind(s, partial); res = r; return r.state; });
        return res.find;
      },
      updateFind: function (id, patch) {
        var res;
        patchData(function (s) { var r = updateFind(s, id, patch); res = r; return r.state; });
        return res.find;
      },
      deleteFind: function (id) {
        patchData(function (s) { return deleteFind(s, id).state; });
      },
      createGroup: function (opts) {
        var res;
        patchData(function (s) { var r = createGroup(s, opts); res = r; return r.state; });
        return res.group;
      },
      joinGroup: function (opts) {
        var res;
        patchData(function (s) { var r = joinGroup(s, opts); res = r; return r.state; });
        return res.group;
      },
      switchGroup: function (id) {
        patchData(function (s) { return switchGroup(s, id).state; });
      },
      deleteGroup: function (id) {
        patchData(function (s) { return deleteGroup(s, id).state; });
      },
      exportGroup: function (gid) {
        return exportGroup(uiState.data, gid);
      },
      importGroup: function (input) {
        var res;
        patchData(function (s) { var r = importGroup(s, input); res = r; return r.state; });
        return res.result;
      },
    };
  }

  // --- Exports --------------------------------------------------------------
  global.AF = global.AF || {};
  global.AF.STORAGE_KEY = STORAGE_KEY;
  global.AF.SCHEMA_VERSION = SCHEMA_VERSION;
  global.AF.EXPORT_FORMAT = EXPORT_FORMAT;
  global.AF.TYPES = TYPES;
  global.AF.MATERIALS = MATERIALS;
  global.AF.CONDITIONS = CONDITIONS;

  // Pure reducer exports (for tests)
  global.AF.reducers = {
    freshState: freshState,
    createFind: createFind,
    updateFind: updateFind,
    deleteFind: deleteFind,
    createGroup: createGroup,
    joinGroup: joinGroup,
    switchGroup: switchGroup,
    deleteGroup: deleteGroup,
    exportGroup: exportGroup,
    importGroup: importGroup,
    findsForGroup: findsForGroup,
    uniqueGroupCode: uniqueGroupCode,
  };

  global.AF.createStore = createStore;
})(typeof window !== "undefined" ? window : global);
