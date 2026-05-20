/* ---------- Geolocation helpers ----------
 * Promise wrapper around navigator.geolocation + tiny distance helper.
 */
(function (global) {
  "use strict";

  function capturePosition(opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        var err = new Error("Geolocation not available");
        err.code = "UNAVAILABLE";
        return reject(err);
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          });
        },
        function (err) {
          var out = new Error(err.message || "Position error");
          if (err.code === 1) out.code = "PERMISSION_DENIED";
          else if (err.code === 2) out.code = "UNAVAILABLE";
          else if (err.code === 3) out.code = "TIMEOUT";
          else out.code = "UNKNOWN";
          reject(out);
        },
        {
          enableHighAccuracy: opts.enableHighAccuracy !== false,
          timeout: opts.timeout || 15000,
          maximumAge: opts.maximumAge || 0,
        }
      );
    });
  }

  function haversineMeters(a, b) {
    var R = 6371000;
    var toRad = function (d) { return (d * Math.PI) / 180; };
    var dLat = toRad(b.lat - a.lat);
    var dLng = toRad(b.lng - a.lng);
    var lat1 = toRad(a.lat);
    var lat2 = toRad(b.lat);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  global.AF = global.AF || {};
  global.AF.geo = {
    capturePosition: capturePosition,
    haversineMeters: haversineMeters,
  };
})(typeof window !== "undefined" ? window : global);
