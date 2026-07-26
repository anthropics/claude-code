#!/usr/bin/env python3
"""Reconcile the R6 decision store against the audit outcome store.

Why this exists: nothing read ~/.web4/r6/ until 2026-07-26, which is how a torn
line sat in 2026-07-26.jsonl undetected — and how the day's decision count was
reported as 72 by two independent readers when 74 writes had been attempted.

It counts three classes, not two. A whole-line JSONL parser sees only the first:

  1. lines that do not parse            (visible loss)
  2. records recoverable only by raw-decoding inside a torn line
     (invisible to standard tooling, but intact)
  3. destroyed fragments — an id and a few bytes, no verdict
     (the record is gone; its decision cannot be attributed)

...and then joins decisions to outcomes per session, because pre_tool_use.py
writes one shared daily file (all sessions) while post_tool_use.py writes one
file per session. A session with decisions and no audit file is invisible to any
count that starts from the audit store.

Exit status is 0 only when every line parses and every decision has an outcome.

Usage:
    r6_reconcile.py [YYYY-MM-DD ...]     # default: today (UTC)
    r6_reconcile.py --all                # every r6 day file present
"""

import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

R6_DIR = Path.home() / ".web4" / "r6"
AUDIT_DIR = Path.home() / ".web4" / "audit"

_DECODER = json.JSONDecoder()


def scan_r6_day(path):
    """Return (records, torn) for one r6 day file.

    records: every complete record, including ones embedded in a torn line.
    torn: one entry per unparseable line: (lineno, [complete ids], [fragments]).
    A fragment is (raw_prefix, byte_len) — what survived of a destroyed record.
    """
    records, torn = [], []
    raw = path.read_text(encoding="utf-8", errors="replace")
    for lineno, line in enumerate(raw.split("\n"), start=1):
        if not line.strip():
            continue
        try:
            records.append(json.loads(line))
            continue
        except ValueError:
            pass
        # Torn line: walk it, raw-decoding every complete object and treating
        # each gap between objects as a destroyed record. gap_start trails pos
        # so a fragment keeps its own opening brace — the brace is part of the
        # destroyed record, and counting from after it under-reports by a byte.
        complete, fragments, pos, gap_start = [], [], 0, 0
        while pos < len(line):
            start = line.find("{", pos)
            if start < 0:
                break
            try:
                obj, end = _DECODER.raw_decode(line, start)
            except ValueError:
                pos = start + 1
                continue
            if start > gap_start:
                fragments.append((line[gap_start:start], start - gap_start))
            records.append(obj)
            complete.append(obj.get("id", "?"))
            pos = gap_start = end
        if gap_start < len(line.rstrip()):
            fragments.append((line[gap_start:], len(line.rstrip()) - gap_start))
        torn.append((lineno, complete, fragments))
    return records, torn


def audit_index():
    """Index the whole audit store once.

    Built once and reused across days — the store is 1,700+ files, so scanning
    it per requested day made --all quadratic enough to discourage running it,
    and a check nobody runs is the defect this script exists to fix.

    Returns (by_day, by_id, health):
      by_day  {day: Counter({session: outcomes})}  — session-grain, kept for the
              per-session table only.
      by_id   Counter({r6_request_id: outcomes})   — the real join. Every audit
              record carries the pre hook's own r6 id, so decisions and outcomes
              join per call, not per session. An earlier version of this script
              claimed no per-call key existed; it was in the schema all along
              (kimi-code, 2026-07-26). Session-grain counting is both blind to
              cross-midnight outcomes and masked from below by duplicate
              records, so it understates the gap.
      health  aggregate degeneracy counters — see report_health().
    """
    by_day = {}
    by_id = Counter()
    health = {"records": 0, "status": Counter(), "null_output": 0, "no_key": 0}
    if not AUDIT_DIR.is_dir():
        return by_day, by_id, health
    for path in AUDIT_DIR.glob("*.jsonl"):
        session = path.stem
        for line in path.read_text(encoding="utf-8", errors="replace").split("\n"):
            if not line.strip():
                continue
            try:
                rec = json.loads(line)
            except ValueError:
                # A torn audit line is itself a finding; not counting it lets
                # the totals disagree rather than hiding the loss.
                continue
            day = str(rec.get("timestamp", ""))[:10]
            by_day.setdefault(day, Counter())[session] += 1
            key = rec.get("r6_request_id")
            if key:
                by_id[key] += 1
            else:
                health["no_key"] += 1
            result = rec.get("result", {})
            health["records"] += 1
            health["status"][result.get("status", "?")] += 1
            if result.get("output_hash") in (None, "null"):
                health["null_output"] += 1
    return by_day, by_id, health


def report_health(health):
    """Flag outcome fields that never vary.

    A constant is not evidence. The audit store recorded status="success" for
    76,292 of 76,292 records over six months — not because nothing failed, but
    because the post hook read `tool_output`/`tool_error`, keys Claude Code does
    not send (it sends `tool_response`). The store looked healthy the whole time:
    every record present, every record "success". Nothing checked whether the
    outcome field could take a second value, so nothing noticed the R6 Result was
    hardcoded by accident. This check is that missing question.
    """
    n = health["records"]
    if not n:
        return True
    ok = True
    print("=== audit store health ===")
    print(f"audit records         : {n}")
    print(f"   status values      : {dict(health['status'])}")
    if len(health["status"]) < 2:
        only = next(iter(health["status"]), "?")
        print(f"   DEGENERATE: status is always {only!r} — the outcome field "
              "carries no information")
        ok = False
    pct = 100.0 * health["null_output"] / n
    print(f"   null output_hash   : {health['null_output']} ({pct:.1f}%)")
    if pct > 99.0:
        print("   DEGENERATE: output is essentially never hashed — audit records "
              "attest that a hook ran, not what the tool did")
        ok = False
    if health["no_key"]:
        print(f"   MISSING JOIN KEY   : {health['no_key']} records without "
              "r6_request_id (cannot be joined to a decision)")
        ok = False
    return ok


def reconcile(day, audit_by_day, audit_by_id):
    path = R6_DIR / f"{day}.jsonl"
    if not path.exists():
        print(f"{day}: no r6 store")
        return True

    records, torn = scan_r6_day(path)
    destroyed = [f for _, _, frags in torn for f in frags]
    attempted = len(records) + len(destroyed)
    verdicts = Counter(r.get("policy", {}).get("decision", "?") for r in records)

    print(f"=== {day} ===")
    print(f"r6 writes attempted   : {attempted}")
    print(f"   intact records     : {len(records)}  ({dict(verdicts)})")
    print(f"   destroyed records  : {len(destroyed)}  (verdict unattributable)")
    if torn:
        for lineno, complete, frags in torn:
            print(f"   TORN line {lineno}: intact={complete or '[]'}")
            for prefix, nbytes in frags:
                print(f"      destroyed: {nbytes}B {prefix[:64]!r}")
        print("   NOTE: a whole-line parser reports "
              f"{len(records) - sum(len(c) for _, c, _ in torn)} records here.")

    # Decisions come from the pre hook, outcomes from the post hook, and every
    # audit record carries the decision's own id — so join per call. Unlike the
    # session-count join this is day-independent (an outcome written after
    # midnight still matches) and immune to duplicate outcomes inflating a
    # session's total. What remains unmatched is exactly "no outcome with this
    # id exists anywhere in the store".
    decisions = Counter(
        r.get("reference", {}).get("session_id", "?") for r in records
    )
    outcomes = audit_by_day.get(day, Counter())
    print(f"outcomes recorded     : {sum(outcomes.values())}  "
          f"(same-day, session-grain)")

    missing = [r for r in records if not audit_by_id.get(r.get("id"))]
    gap_total = len(missing)
    dup = [(r.get("id"), audit_by_id[r.get("id")]) for r in records
           if audit_by_id.get(r.get("id"), 0) > 1]
    print(f"unmatched decisions   : {gap_total}  (no outcome with this id, "
          f"anywhere)")
    if dup:
        print(f"duplicated outcomes   : {len(dup)} ids with more than one audit "
              f"record ({sum(n - 1 for _, n in dup)} extra)")

    # Same-instant decisions in one session contend for the session file's single
    # `pending_r6` slot: last writer wins, and the losers can never be completed.
    # Reported next to the gap because it is the leading candidate mechanism.
    by_session = {}
    for r in records:
        by_session.setdefault(
            r.get("reference", {}).get("session_id", "?"), []
        ).append(r)
    collisions = 0
    for sess_records in by_session.values():
        seen = Counter(r.get("role", {}).get("action_index") for r in sess_records)
        collisions += sum(n - 1 for n in seen.values() if n > 1)
    if collisions:
        print(f"action_index reuse    : {collisions}  (concurrent pre hooks lost "
              f"an update to the session file)")

    if gap_total:
        print("   session                                dec  out  gap  audit-file")
        rows = []
        for session, n_dec in decisions.most_common():
            n_out = outcomes.get(session, 0)
            has_file = (AUDIT_DIR / f"{session}.jsonl").exists()
            rows.append((session, n_dec, n_out, n_dec - n_out, has_file))
        for session, n_dec, n_out, gap, has_file in rows:
            mark = "" if has_file else "  <== NO AUDIT FILE"
            print(f"   {session:38s} {n_dec:4d} {n_out:4d} {gap:4d}  "
                  f"{'yes' if has_file else 'no':3s}{mark}")

    clean = not torn and gap_total == 0
    print("verdict               :", "clean" if clean else "DEFECTS PRESENT")
    return clean


def main(argv):
    if "--all" in argv:
        days = sorted(p.stem for p in R6_DIR.glob("*.jsonl"))
    else:
        days = [a for a in argv[1:] if not a.startswith("-")] or [
            datetime.now(timezone.utc).strftime("%Y-%m-%d")
        ]
    audit_by_day, audit_by_id, health = audit_index()
    ok = True
    for day in days:
        ok = reconcile(day, audit_by_day, audit_by_id) and ok
        print()
    ok = report_health(health) and ok
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
