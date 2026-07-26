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
    """Index the whole audit store once: {day: Counter({session: outcomes})}.

    Built once and reused across days — the store is 1,700+ files, so scanning
    it per requested day made --all quadratic enough to discourage running it,
    and a check nobody runs is the defect this script exists to fix.
    """
    by_day = {}
    if not AUDIT_DIR.is_dir():
        return by_day
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
    return by_day


def reconcile(day, audit_by_day):
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

    # Decisions are written by the pre hook, outcomes by the post hook. They can
    # only be joined on session_id today; there is no per-call join key.
    decisions = Counter(
        r.get("reference", {}).get("session_id", "?") for r in records
    )
    outcomes = audit_by_day.get(day, Counter())
    print(f"outcomes recorded     : {sum(outcomes.values())}")

    gap_total = 0
    rows = []
    for session, n_dec in decisions.most_common():
        n_out = outcomes.get(session, 0)
        has_file = (AUDIT_DIR / f"{session}.jsonl").exists()
        gap = n_dec - n_out
        gap_total += max(gap, 0)
        rows.append((session, n_dec, n_out, gap, has_file))
    if gap_total:
        print(f"unmatched decisions   : {gap_total}  (decision with no outcome)")
        print("   session                                dec  out  gap  audit-file")
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
    audit_by_day = audit_index()
    ok = True
    for day in days:
        ok = reconcile(day, audit_by_day) and ok
        print()
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
