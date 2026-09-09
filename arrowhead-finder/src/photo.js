/* ---------- Photo helpers ----------
 * Reads a File via FileReader, downscales with a hidden canvas, and
 * produces a second tiny thumbnail dataURL used by map markers and lists.
 * Guarded so the module loads under Node (for tests) without touching DOM.
 */
(function (global) {
  "use strict";

  var hasDom = typeof document !== "undefined" && typeof Image !== "undefined";

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (typeof FileReader === "undefined") return reject(new Error("FileReader unavailable"));
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error || new Error("read failed")); };
      fr.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("image decode failed")); };
      img.src = dataUrl;
    });
  }

  function downscale(dataUrl, maxEdge, quality) {
    if (!hasDom) return Promise.resolve(dataUrl);
    maxEdge = maxEdge || 1024;
    quality = typeof quality === "number" ? quality : 0.75;
    return loadImage(dataUrl).then(function (img) {
      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      var scale = Math.min(1, maxEdge / Math.max(w, h));
      var dw = Math.max(1, Math.round(w * scale));
      var dh = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, dw, dh);
      return canvas.toDataURL("image/jpeg", quality);
    });
  }

  function makeThumb(dataUrl) {
    return downscale(dataUrl, 128, 0.72);
  }

  // Convenience: file -> { photoDataUrl, thumbDataUrl }
  function processFile(file) {
    return readFileAsDataUrl(file)
      .then(function (raw) { return downscale(raw, 1024, 0.75); })
      .then(function (photo) {
        return makeThumb(photo).then(function (thumb) {
          return { photoDataUrl: photo, thumbDataUrl: thumb };
        });
      });
  }

  global.AF = global.AF || {};
  global.AF.photo = {
    readFileAsDataUrl: readFileAsDataUrl,
    downscale: downscale,
    makeThumb: makeThumb,
    processFile: processFile,
  };
})(typeof window !== "undefined" ? window : global);
