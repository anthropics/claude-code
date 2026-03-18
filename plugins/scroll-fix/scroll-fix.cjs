/**
 * scroll-fix.cjs — Fixes terminal scroll-to-top regression in Claude Code
 *
 * ROOT CAUSE (v2):
 *   TWO sources of excessive cursor-up sequences:
 *   1. Ink renderer's eraseLines() within synchronized output blocks
 *   2. Readline/prompt system's eraseLines(this.height) OUTSIDE sync blocks
 *   Both generate cursor-up sequences exceeding viewport height, causing
 *   ALL terminals to snap the viewport to the top.
 *
 * FIX:
 *   Intercepts ALL process.stdout.write calls. Every cursor-up sequence
 *   (\x1b[{n}A) is clamped so the TOTAL cursor-up per write call never
 *   exceeds process.stdout.rows. No sync-block tracking needed.
 *
 * ADDITIONAL — Ctrl+6 freeze toggle:
 *   Press Ctrl+6 to freeze all re-render output. Press again to unfreeze.
 *
 * Upstream: microsoft/terminal#14774, anthropics/claude-code#33814
 */

"use strict";

(function () {
  var _ow = process.stdout.write.bind(process.stdout);
  var _frozen = false;
  var _buf = [];

  /* ── Ctrl+6 freeze toggle (\x1e) ──────────────────────────────────── */
  setTimeout(function () {
    try {
      process.stdin.on("data", function (d) {
        if (d.toString().indexOf("\x1e") !== -1) {
          _frozen = !_frozen;
          if (_frozen) {
            _ow("\x1b]0;Claude Code [FROZEN - Ctrl+6 to resume]\x07");
          } else {
            if (_buf.length > 0) {
              var a = "";
              for (var i = 0; i < _buf.length; i++) a += _buf[i];
              _buf = [];
              _ow(a);
            }
            _ow("\x1b]0;Claude Code\x07");
          }
        }
      });
    } catch (e) {}
  }, 2000);

  /* ── stdout.write interceptor ─────────────────────────────────────── */
  process.stdout.write = function (d, e, c) {
    if (typeof e === "function") {
      c = e;
      e = void 0;
    }
    var s =
      typeof d === "string"
        ? d
        : Buffer.isBuffer(d)
          ? d.toString("utf-8")
          : String(d);
    var maxUp = process.stdout.rows || 24;

    /* Clamp cursor-up per write call.
     * Never let total upward movement in a single write exceed viewport. */
    var upBudget = maxUp;

    s = s.replace(/\x1b\[(\d*)A/g, function (m, p) {
      var n = parseInt(p) || 1;
      if (upBudget <= 0) return "";
      var allowed = n > upBudget ? upBudget : n;
      upBudget -= allowed;
      return "\x1b[" + allowed + "A";
    });

    /* Freeze: buffer ALL output when frozen */
    if (_frozen) {
      _buf.push(s);
      if (c) c();
      return true;
    }

    if (typeof d === "string") return _ow(s, e, c);
    return _ow(Buffer.from(s, "utf-8"), e, c);
  };
})();
