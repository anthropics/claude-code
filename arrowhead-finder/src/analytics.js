/* ---------- Analytics ----------
 * Pure functions over the finds collection. Returns a single object the
 * analytics view can render without further computation.
 */
(function (global) {
  "use strict";

  function byGroup(state, gid) {
    var out = [];
    var keys = Object.keys(state.finds);
    for (var i = 0; i < keys.length; i++) {
      var f = state.finds[keys[i]];
      if (f.groupId === gid) out.push(f);
    }
    return out;
  }

  function count(arr, keyFn) {
    var map = {};
    for (var i = 0; i < arr.length; i++) {
      var k = keyFn(arr[i]) || "Unknown";
      map[k] = (map[k] || 0) + 1;
    }
    return map;
  }

  function toSortedEntries(obj) {
    var keys = Object.keys(obj);
    var pairs = [];
    for (var i = 0; i < keys.length; i++) pairs.push({ label: keys[i], count: obj[keys[i]] });
    pairs.sort(function (a, b) { return b.count - a.count || (a.label < b.label ? -1 : 1); });
    return pairs;
  }

  function sizeBuckets(finds) {
    var buckets = [
      { label: "< 25 mm", min: 0, max: 25, count: 0 },
      { label: "25-40 mm", min: 25, max: 40, count: 0 },
      { label: "40-55 mm", min: 40, max: 55, count: 0 },
      { label: "55-70 mm", min: 55, max: 70, count: 0 },
      { label: "70+ mm", min: 70, max: Infinity, count: 0 },
    ];
    for (var i = 0; i < finds.length; i++) {
      var s = finds[i].size;
      if (!s || typeof s.lengthMm !== "number") continue;
      for (var b = 0; b < buckets.length; b++) {
        if (s.lengthMm >= buckets[b].min && s.lengthMm < buckets[b].max) {
          buckets[b].count++;
          break;
        }
      }
    }
    return buckets;
  }

  var WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  function timeline(finds, weeks, now) {
    weeks = weeks || 12;
    now = now || Date.now();
    // Normalize "now" to end of current week bucket. Keep it simple: end = now.
    var buckets = [];
    for (var w = weeks - 1; w >= 0; w--) {
      var end = now - w * WEEK_MS;
      var start = end - WEEK_MS;
      buckets.push({ start: start, end: end, count: 0 });
    }
    for (var i = 0; i < finds.length; i++) {
      var t = finds[i].createdAt;
      if (typeof t !== "number") continue;
      for (var b = 0; b < buckets.length; b++) {
        if (t > buckets[b].start && t <= buckets[b].end) {
          buckets[b].count++;
          break;
        }
      }
    }
    return buckets;
  }

  function hotspots(finds, topN) {
    topN = topN || 5;
    // Bucket to ~0.01 deg cells (roughly 1.1 km lat). Accept that longitude
    // cells get narrower toward the poles; good enough for a hobby app.
    var cells = {};
    for (var i = 0; i < finds.length; i++) {
      var c = finds[i].coords;
      if (!c) continue;
      var latKey = Math.floor(c.lat * 100);
      var lngKey = Math.floor(c.lng * 100);
      var key = latKey + "," + lngKey;
      if (!cells[key]) {
        cells[key] = {
          lat: (latKey + 0.5) / 100,
          lng: (lngKey + 0.5) / 100,
          count: 0,
        };
      }
      cells[key].count++;
    }
    var list = [];
    var keys = Object.keys(cells);
    for (var k = 0; k < keys.length; k++) list.push(cells[keys[k]]);
    list.sort(function (a, b) { return b.count - a.count; });
    return list.slice(0, topN);
  }

  function daysHunted(finds) {
    var seen = {};
    for (var i = 0; i < finds.length; i++) {
      var d = new Date(finds[i].createdAt);
      var key = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
      seen[key] = true;
    }
    return Object.keys(seen).length;
  }

  function largestLengthMm(finds) {
    var max = 0;
    for (var i = 0; i < finds.length; i++) {
      var s = finds[i].size;
      if (s && typeof s.lengthMm === "number" && s.lengthMm > max) max = s.lengthMm;
    }
    return max;
  }

  function getAnalytics(state, gid, now) {
    var finds = byGroup(state, gid);
    var byType = count(finds, function (f) { return f.type; });
    var byMaterial = count(finds, function (f) { return f.material; });
    var uniqueTypes = Object.keys(byType).filter(function (k) { return k && k !== "Unknown"; }).length;
    return {
      totalFinds: finds.length,
      daysHunted: daysHunted(finds),
      uniqueTypes: uniqueTypes,
      largestLengthMm: largestLengthMm(finds),
      byType: toSortedEntries(byType),
      byMaterial: toSortedEntries(byMaterial),
      sizeBuckets: sizeBuckets(finds),
      timeline: timeline(finds, 12, now),
      hotspots: hotspots(finds, 5),
    };
  }

  global.AF = global.AF || {};
  global.AF.analytics = {
    getAnalytics: getAnalytics,
    sizeBuckets: sizeBuckets,
    timeline: timeline,
    hotspots: hotspots,
    daysHunted: daysHunted,
    largestLengthMm: largestLengthMm,
  };
})(typeof window !== "undefined" ? window : global);
