/* Node smoke test for store, analytics, and export/import roundtrip.
 * Fakes window + localStorage so the browser modules can be required. */
"use strict";

var fakeWindow = {};
global.window = fakeWindow;
global.localStorage = {
  _s: {},
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
  setItem: function (k, v) { this._s[k] = String(v); },
  removeItem: function (k) { delete this._s[k]; },
};
// Skip canvas-touching paths in photo.js by leaving `document` undefined.

require("./src/store.js");
require("./src/analytics.js");
require("./src/geo.js");
require("./src/photo.js");

var AF = fakeWindow.AF;
var R = AF.reducers;

var failed = 0;
var passed = 0;
function ok(label, cond, detail) {
  if (cond) { passed++; console.log("PASS  " + label); }
  else { failed++; console.log("FAIL  " + label + (detail ? " — " + detail : "")); }
}

// ---- T1: create group ----
(function () {
  var s = R.freshState();
  var res = R.createGroup(s, { name: "Test Hunt" });
  ok("T1 group active after create", res.state.activeGroupId === res.group.id);
  ok("T1 group code matches regex", /^[A-Z]{3}-\d[A-Z]{2}$/.test(res.group.code), "got " + res.group.code);
  ok("T1 group is stored", res.state.groups[res.group.id] === res.group);
})();

// ---- T2: create find, assigns groupId ----
(function () {
  var s = R.freshState();
  var g = R.createGroup(s, { name: "Test" });
  var res = R.createFind(g.state, {
    coords: { lat: 35.1, lng: -85.2, accuracy: 8 },
    type: "Clovis",
    material: "chert",
    size: { lengthMm: 58, widthMm: 22 },
  });
  ok("T2 find has id", !!res.find.id && res.find.id.indexOf("fnd_") === 0);
  ok("T2 find groupId matches active", res.find.groupId === g.state.activeGroupId);
  ok("T2 find in state.finds", !!res.state.finds[res.find.id]);
  ok("T2 createAt/updatedAt set", typeof res.find.createdAt === "number" && res.find.updatedAt === res.find.createdAt);

  var thrown = null;
  try { R.createFind(g.state, {}); } catch (e) { thrown = e.message; }
  ok("T2 rejects missing coords", thrown === "MISSING_COORDS");

  var s2 = R.freshState();
  var thrown2 = null;
  try { R.createFind(s2, { coords: { lat: 1, lng: 1, accuracy: 1 } }); } catch (e) { thrown2 = e.message; }
  ok("T2 rejects when no active group", thrown2 === "NO_ACTIVE_GROUP");
})();

// ---- T3: analytics over 5 varied finds ----
(function () {
  var s = R.freshState();
  var g = R.createGroup(s, { name: "Analytics" });
  s = g.state;
  var now = Date.now();
  var samples = [
    { type: "Clovis", material: "chert", lengthMm: 50 },
    { type: "Clovis", material: "flint", lengthMm: 38 },
    { type: "Folsom", material: "chert", lengthMm: 62 },
    { type: "Archaic Stemmed", material: "chert", lengthMm: 24 },
    { type: "Woodland Triangular", material: "quartz", lengthMm: 78 },
  ];
  for (var i = 0; i < samples.length; i++) {
    s = R.createFind(s, {
      coords: { lat: 35 + i * 0.001, lng: -85 + i * 0.001, accuracy: 10 },
      type: samples[i].type,
      material: samples[i].material,
      size: { lengthMm: samples[i].lengthMm, widthMm: 20 },
    }).state;
  }
  var a = AF.analytics.getAnalytics(s, g.state.activeGroupId, now);
  ok("T3 totalFinds=5", a.totalFinds === 5, "got " + a.totalFinds);
  var clovisEntry = a.byType.find(function (e) { return e.label === "Clovis"; });
  ok("T3 byType Clovis=2", clovisEntry && clovisEntry.count === 2);
  ok("T3 uniqueTypes=4", a.uniqueTypes === 4, "got " + a.uniqueTypes);
  var sizeSum = a.sizeBuckets.reduce(function (n, b) { return n + b.count; }, 0);
  ok("T3 sizeBuckets sum=5", sizeSum === 5, "got " + sizeSum);
  var lastWeek = a.timeline[a.timeline.length - 1];
  ok("T3 latest week has 5 finds", lastWeek.count === 5, "got " + lastWeek.count);
  ok("T3 largestLengthMm=78", a.largestLengthMm === 78);
  ok("T3 hotspots non-empty", a.hotspots.length >= 1);
})();

// ---- T4: export / import / idempotent re-import ----
(function () {
  var s = R.freshState();
  s = R.createGroup(s, { name: "Export" }).state;
  var gid = s.activeGroupId;
  var now = Date.now();
  // Seed 5 finds with deterministic ids by using createFind (ids will differ each run, that's fine).
  for (var i = 0; i < 5; i++) {
    s = R.createFind(s, {
      coords: { lat: 35 + i, lng: -85, accuracy: 10 },
      type: "Clovis",
      material: "chert",
    }).state;
  }
  var exportObj = R.exportGroup(s, gid);
  ok("T4 export has correct format", exportObj.format === AF.EXPORT_FORMAT);
  ok("T4 export has 1 group + 5 finds", exportObj.finds.length === 5 && exportObj.group.id === gid);

  var serialized = JSON.stringify(exportObj);

  // Blow away all finds, keep group around.
  var empty = R.freshState();
  empty.groups[gid] = s.groups[gid];
  empty.activeGroupId = gid;

  var imp = R.importGroup(empty, serialized);
  ok("T4 first import added 5", imp.result.added === 5 && imp.result.updated === 0 && imp.result.skipped === 0,
    "got " + JSON.stringify(imp.result));

  var imp2 = R.importGroup(imp.state, serialized);
  ok("T4 re-import skips all 5", imp2.result.added === 0 && imp2.result.updated === 0 && imp2.result.skipped === 5,
    "got " + JSON.stringify(imp2.result));
})();

// ---- T5: last-write-wins on updatedAt ----
(function () {
  var s = R.freshState();
  s = R.createGroup(s, { name: "LWW" }).state;
  var gid = s.activeGroupId;
  var created = R.createFind(s, {
    coords: { lat: 35, lng: -85, accuracy: 5 },
    type: "Clovis",
    material: "chert",
  });
  s = created.state;
  var findId = created.find.id;

  var exportAt_T1 = R.exportGroup(s, gid);

  // Mutate the local find to a newer updatedAt.
  s.finds[findId] = Object.assign({}, s.finds[findId], {
    notes: "newer local note",
    updatedAt: exportAt_T1.finds[0].updatedAt + 5000,
  });

  // Importing the OLDER copy should skip.
  var imp = R.importGroup(s, JSON.stringify(exportAt_T1));
  ok("T5 older import is skipped", imp.result.skipped === 1 && imp.result.updated === 0, JSON.stringify(imp.result));

  // Export NEW local copy, revert local to original, import — should Update.
  var exportAt_T2 = R.exportGroup(s, gid); // reflects new note + newer updatedAt
  s.finds[findId] = Object.assign({}, s.finds[findId], {
    notes: "original",
    updatedAt: exportAt_T1.finds[0].updatedAt,
  });
  var imp2 = R.importGroup(s, JSON.stringify(exportAt_T2));
  ok("T5 newer import updates", imp2.result.updated === 1 && imp2.result.added === 0, JSON.stringify(imp2.result));
  ok("T5 notes replaced on update", imp2.state.finds[findId].notes === "newer local note");
})();

// ---- T6: joinGroup placeholder then import merges into same local id ----
(function () {
  var s = R.freshState();
  // Partner creates a group and seeds a find.
  var partner = R.createGroup(R.freshState(), { name: "Creek Bottom" });
  var partnerState = partner.state;
  partnerState = R.createFind(partnerState, {
    coords: { lat: 35, lng: -85, accuracy: 5 },
    type: "Folsom", material: "chert",
  }).state;
  var exp = R.exportGroup(partnerState, partner.group.id);

  // On our device: joinGroup by that code (creates a placeholder with a DIFFERENT local id).
  var joined = R.joinGroup(s, { code: partner.group.code, name: "Me" });
  ok("T6 join placeholder has active group", joined.state.activeGroupId === joined.group.id);
  ok("T6 local group id differs from partner's", joined.group.id !== partner.group.id);

  // Now import partner's file. Expect finds to land under the local id.
  var imp = R.importGroup(joined.state, JSON.stringify(exp));
  ok("T6 import added 1", imp.result.added === 1, JSON.stringify(imp.result));
  ok("T6 import groupId is the local id", imp.result.groupId === joined.group.id);
  var findKeys = Object.keys(imp.state.finds);
  ok("T6 find now has local groupId", findKeys.length === 1 && imp.state.finds[findKeys[0]].groupId === joined.group.id);
})();

// ---- Summary ----
console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
