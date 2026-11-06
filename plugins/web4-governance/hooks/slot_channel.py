#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Governance Plugin - PreToolUse -> PostToolUse correlation channel
# https://github.com/dp-web4/web4

"""
The pre->post channel: a per-call pending map, locked, with logged expiry.

## What this replaces, and what each part fixes

Until 2026-07-26 the PreToolUse hook handed its R6 request to the
PostToolUse hook through a *single* session field::

    session["pending_r6"] = r6      # pre_tool_use.py
    r6 = session.get("pending_r6")  # post_tool_use.py
    session["pending_r6"] = None

One slot, no key, no lock, no expiry. Three measured symptoms, one defect
(measured over ~92k r6 records and ~76k audit records in ``~/.web4``):

1. **Missing audits (the gap).** 91,992 r6 records vs 76,293 audit records.
   768 of the 17,223-record gap are correct terminal denials (an r6 record
   is written for a blocked tool that never ran, so no audit record can
   exist -- see ``log_r6`` call sites in ``pre_tool_use.py``). The residual
   16,455 is slot loss: a second PreToolUse overwrote the slot before the
   first call's PostToolUse could read it. **Fixed by the map** -- calls no
   longer share one cell.

2. **Duplicate audits.** 1,460 ``record_id`` values appear more than once,
   1,526 extra copies. Anatomy: identical ``output_hash``, identical
   ``action_index``, timestamps 6.4 ms apart at p50 (674/1526 under 1 ms),
   and the *r6* record is NOT duplicated (2 of 91,990). So the pre-hook ran
   once and the post-hook ran twice, both reading the slot before either
   cleared it. A map alone does not fix this. **Fixed by the lock** --
   match-and-pop is atomic, so the second reader finds the entry gone.
   (3 of the 1,526 are 32-bit id collisions, not double writes -- one pair
   is 83 days apart. Those are an id-width problem, not a channel problem.)

3. **Task blindness.** Task is the one tool that genuinely runs concurrently
   with its parent session, and it lost 82% of its audit records. Loss needs
   *overlap*, not duration: a long call with nothing beside it is never
   displaced. Fixed by the map, for the same reason as (1).

## Design notes worth keeping

**The key is computable on both sides.** ``tool_use_id`` is present on
PreToolUse payloads but is not documented for PostToolUse, so it cannot be
the primary key. The key is ``tool_name`` + a hash of ``tool_input`` -- both
documented on both events -- and ``tool_use_id`` is used as a tiebreaker
within a key when both sides happen to carry it. Match mode is *recorded on
every audit record* (``channel.match_mode``) rather than assumed, so the
next data-side pass can measure how often keying actually works instead of
taking this docstring's word for it.

**TTL is a garbage collector, not a duration policy.** The expiry window is
parameterized by expected *overlap*, not by expected call duration: a Task
call may legitimately be outstanding for many minutes, and expiring it
while it runs would manufacture exactly the loss this module exists to stop.
Default 3600s, ``WEB4_PENDING_TTL_SECONDS`` to override.

**Nothing is dropped silently.** Expired entries, evicted entries,
unmatched post-hooks and failed lock acquisitions all append a record to
``~/.web4/channel/<date>.jsonl``. The reason is the same one that shows up
at every layer of this system: a success path that destroys its own
evidence turns "we lost 16,455 records" into a fact you can only recover by
joining two stores months later. With this log the acceptance test is a
direct read -- the residual gap should stop growing, and if it doesn't, the
channel log says which of the four ways it failed.

**Fail-open, always.** A governance hook that blocks or crashes costs a tool
call. If the lock cannot be acquired within the timeout the update proceeds
unlocked and says so (``channel.lock == "timeout"``); if anything in here
raises, the caller is expected to carry on.
"""

import fcntl
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

WEB4_DIR = Path.home() / ".web4"
SESSION_DIR = WEB4_DIR / "sessions"
CHANNEL_LOG_DIR = WEB4_DIR / "channel"

# Overlap-parameterized, not duration-parameterized. See module docstring.
PENDING_TTL_SECONDS = float(os.environ.get("WEB4_PENDING_TTL_SECONDS", 3600))
# Backstop against unbounded growth if PostToolUse stops firing entirely.
PENDING_MAX = int(os.environ.get("WEB4_PENDING_MAX", 256))
LOCK_TIMEOUT_SECONDS = float(os.environ.get("WEB4_LOCK_TIMEOUT_SECONDS", 1.5))
LOCK_POLL_SECONDS = 0.005


def _now():
    return datetime.now(timezone.utc)


def utc_iso():
    """The timestamp convention already used by both stores."""
    return _now().isoformat() + "Z"


def input_hash(tool_input):
    """Hash of the tool input.

    Must stay byte-identical to ``create_r6_request``'s ``request.input_hash``
    in pre_tool_use.py -- the R6 record and the channel key are the same
    quantity, and a divergence between them would be exactly the
    numerator/denominator class of error this project keeps finding.
    """
    try:
        blob = json.dumps(tool_input, sort_keys=True)
    except (TypeError, ValueError):
        blob = repr(tool_input)
    return hashlib.sha256(blob.encode()).hexdigest()[:16]


def call_key(tool_name, tool_input):
    return "%s:%s" % (tool_name or "unknown", input_hash(tool_input))


def append_jsonl(path, record):
    """Append one JSON line with a single ``write(2)`` on an O_APPEND fd.

    The stores were written with buffered ``open(path, "a")``, which lets a
    record reach the file in more than one write and therefore interleave with
    a concurrent writer's. It happened: 1 of 168,286 lines across ~/.web4/r6
    and ~/.web4/audit is a torn splice of two records (``r6/2026-07-26.jsonl``,
    line 23). The rate is tiny -- 0.0006% -- but the *class* is not, because a
    torn line is not a lost record, it is an **uncountable** one: every census
    in this investigation, mine included, wrapped ``json.loads`` in a bare
    except and skipped it. A record that defeats the parser is invisible to
    exactly the tools that would have counted it.
    """
    data = (json.dumps(record) + "\n").encode()
    fd = os.open(str(path), os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o644)
    try:
        os.write(fd, data)
    finally:
        os.close(fd)


def log_channel_event(kind, session_id, detail):
    """Append a channel anomaly/lifecycle record. Never raises."""
    try:
        CHANNEL_LOG_DIR.mkdir(parents=True, exist_ok=True)
        today = _now().strftime("%Y-%m-%d")
        record = {
            "timestamp": utc_iso(),
            "kind": kind,
            "session_id": session_id,
            "pid": os.getpid(),
        }
        record.update(detail or {})
        append_jsonl(CHANNEL_LOG_DIR / ("%s.jsonl" % today), record)
    except Exception:
        pass


class session_lock:
    """Exclusive advisory lock on a session's read-modify-write.

    Locks a sidecar ``<session>.lock`` rather than the session file itself,
    because ``save_session`` publishes via ``os.replace`` -- locking the
    file that gets swapped out from under the lock would protect nothing.

    Use as a context manager; the value is True if the lock was actually
    acquired. False means proceed anyway (fail-open) and record it.
    """

    def __init__(self, session_id, timeout=LOCK_TIMEOUT_SECONDS):
        self.session_id = session_id
        self.timeout = timeout
        self.acquired = False
        self.waited = 0.0
        self._fh = None

    def __enter__(self):
        start = time.time()
        try:
            SESSION_DIR.mkdir(parents=True, exist_ok=True)
            self._fh = open(SESSION_DIR / ("%s.lock" % self.session_id), "a+")
        except OSError:
            self._fh = None
            return False
        while True:
            try:
                fcntl.flock(self._fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                self.acquired = True
                break
            except OSError:
                self.waited = time.time() - start
                if self.waited >= self.timeout:
                    break
                time.sleep(LOCK_POLL_SECONDS)
        self.waited = time.time() - start
        if not self.acquired:
            log_channel_event(
                "lock_timeout",
                self.session_id,
                {"waited_seconds": round(self.waited, 4), "timeout": self.timeout},
            )
        return self.acquired

    def __exit__(self, *exc):
        if self._fh is not None:
            try:
                if self.acquired:
                    fcntl.flock(self._fh.fileno(), fcntl.LOCK_UN)
            except OSError:
                pass
            try:
                self._fh.close()
            except OSError:
                pass
        return False

    @property
    def state(self):
        return "held" if self.acquired else "timeout"


def load_raw(session_id):
    """Read a session file. Returns None if absent or unreadable.

    Deliberately does not quarantine -- both hooks already own that policy
    and disagreeing with them here would move it.
    """
    session_file = SESSION_DIR / ("%s.json" % session_id)
    try:
        with open(session_file) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def save_atomic(session):
    """Publish a session via tmp + rename."""
    session_file = SESSION_DIR / ("%s.json" % session["session_id"])
    tmp = session_file.with_suffix(".json.tmp.%d" % os.getpid())
    with open(tmp, "w") as f:
        json.dump(session, f, indent=2)
    os.replace(tmp, session_file)


def _pending(session):
    pending = session.get("pending_calls")
    if not isinstance(pending, dict):
        pending = {}
        session["pending_calls"] = pending
    return pending


def _age_seconds(entry, now_ts):
    try:
        return now_ts - float(entry.get("enqueued_ts", now_ts))
    except (TypeError, ValueError):
        return 0.0


def sweep(session, ttl=PENDING_TTL_SECONDS, max_entries=PENDING_MAX):
    """Expire aged entries and cap map size. Returns the dropped entries.

    Every drop is logged with its reason: an orphan that vanishes without a
    record is the gap all over again, one layer in.
    """
    pending = _pending(session)
    now_ts = time.time()
    dropped = []

    for key in list(pending.keys()):
        entries = pending.get(key) or []
        kept = []
        for entry in entries:
            if _age_seconds(entry, now_ts) > ttl:
                dropped.append(("ttl_expired", entry))
            else:
                kept.append(entry)
        if kept:
            pending[key] = kept
        else:
            pending.pop(key, None)

    flat = [(entry.get("enqueued_ts", 0), key, entry)
            for key, entries in pending.items() for entry in entries]
    if len(flat) > max_entries:
        flat.sort(key=lambda t: t[0])
        for _, key, entry in flat[: len(flat) - max_entries]:
            entries = pending.get(key) or []
            if entry in entries:
                entries.remove(entry)
            if entries:
                pending[key] = entries
            else:
                pending.pop(key, None)
            dropped.append(("evicted_over_max", entry))

    for reason, entry in dropped:
        r6 = entry.get("r6") or {}
        log_channel_event(
            "pending_dropped",
            session.get("session_id"),
            {
                "reason": reason,
                "r6_id": r6.get("id"),
                "tool": (r6.get("request") or {}).get("tool"),
                "age_seconds": round(_age_seconds(entry, now_ts), 3),
                "ttl": ttl,
            },
        )
    return dropped


def enqueue(session, r6, tool_name, tool_input, tool_use_id=None, mcp=None):
    """Add a pending call to the map. Returns the entry."""
    entry = {
        "r6": r6,
        "tool": tool_name,
        "tool_use_id": tool_use_id,
        "enqueued_at": utc_iso(),
        "enqueued_ts": time.time(),
        "mcp": mcp,
    }
    pending = _pending(session)
    pending.setdefault(call_key(tool_name, tool_input), []).append(entry)
    return entry


def pending_depth(session):
    return sum(len(v or []) for v in _pending(session).values())


def match_and_pop(session, tool_name, tool_input, tool_use_id=None):
    """Find this call's pending entry and remove it.

    Returns ``(entry, match_mode)``. Modes, in preference order:

    ``exact_id``      key hit, and ``tool_use_id`` agreed
    ``input_hash``    key hit, oldest entry under that key (FIFO)
    ``fifo_fallback`` no key hit -- oldest pending entry for the whole
                      session. This is the degradation path for the case
                      the design cannot rule out from documentation alone:
                      the harness normalizing ``tool_input`` between the two
                      events. It reproduces the old single-slot behaviour
                      for a single outstanding call, and the mode is
                      recorded so its frequency is measurable.
    ``legacy_slot``   pre-migration session file with a single
                      ``pending_r6`` and no map.
    ``none``          nothing pending -- e.g. the second PostToolUse of a
                      double fire, which is now a logged anomaly instead of
                      a duplicate audit record.
    """
    pending = _pending(session)
    key = call_key(tool_name, tool_input)
    entries = pending.get(key) or []

    if entries:
        chosen, mode = None, "input_hash"
        if tool_use_id:
            for entry in entries:
                if entry.get("tool_use_id") == tool_use_id:
                    chosen, mode = entry, "exact_id"
                    break
        if chosen is None:
            chosen = entries[0]
        entries.remove(chosen)
        if entries:
            pending[key] = entries
        else:
            pending.pop(key, None)
        return chosen, mode

    flat = [(entry.get("enqueued_ts", 0), k, entry)
            for k, es in pending.items() for entry in (es or [])]
    if flat:
        flat.sort(key=lambda t: t[0])
        _, k, entry = flat[0]
        es = pending.get(k) or []
        if entry in es:
            es.remove(entry)
        if es:
            pending[k] = es
        else:
            pending.pop(k, None)
        return entry, "fifo_fallback"

    legacy = session.get("pending_r6")
    if legacy:
        session["pending_r6"] = None
        return {"r6": legacy, "tool": (legacy.get("request") or {}).get("tool"),
                "tool_use_id": None, "enqueued_at": legacy.get("timestamp"),
                "enqueued_ts": None,
                "mcp": session.get("pending_mcp")}, "legacy_slot"

    return None, "none"
