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
from datetime import datetime, timedelta, timezone
from pathlib import Path

R6_DIR = Path.home() / ".web4" / "r6"
AUDIT_DIR = Path.home() / ".web4" / "audit"

_DECODER = json.JSONDecoder()
ABSENT = "<absent>"

# Fields governance CONSUMES — each is a value some component reads to decide
# something, not merely a field the record happens to carry. A degenerate field
# nobody reads is a curiosity; a live field read as a constant is the 2026-01-30
# bug (kimi-code, 2026-07-26). The consumer is named so a failure says who was
# misled, not just which key was flat.
GOVERNED_FIELDS = [
    ("result.status", "the R6 Result verdict itself"),
    ("result.output_hash", "what the audit record attests the tool produced"),
    ("policy_witnessed.success", "PolicyRegistry.witness_decision(success=)"),
    ("policy_witnessed.decision", "the policy verdict being witnessed"),
    ("mcp_witnessed.success", "EntityTrustStore.witness(success=)"),
    ("agent_completion.success", "AgentGovernance.on_agent_complete(success=)"),
    ("heartbeat.status", "timing coherence classification"),
]

# A trailing window, not a census. A census asks "did this field ever vary",
# which the day-one seed record defeats: output_hash has two distinct values
# all-time — "null" and one real sha256 written 2026-01-30 during a manual test —
# so an all-time distinct count certifies it as alive. Worse, a census would
# certify a store that died yesterday, as long as it once lived, and dying-after-
# working is the failure mode this fleet actually gets.
WINDOW_DAYS = 14
MIN_WINDOW_RECORDS = 200   # below this, fall back to the newest N records
MIN_FIELD_SAMPLES = 30     # below this, a field is under-sampled, not degenerate


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
      samples one (day, value-tuple) row per record for the windowed health
              check — tracked fields only, so this stays small.
    """
    by_day = {}
    by_id = Counter()
    samples = []
    no_key = 0
    if not AUDIT_DIR.is_dir():
        return by_day, by_id, (samples, no_key)
    paths = [field.split(".") for field, _ in GOVERNED_FIELDS]
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
                no_key += 1
            row = []
            for parts in paths:
                node, found = rec, True
                for part in parts:
                    if isinstance(node, dict) and part in node:
                        node = node[part]
                    else:
                        found = False
                        break
                # ABSENT distinguishes "field not written" from "field written as
                # null". The first is a dead code path, the second is a flat live
                # one, and collapsing them is how a branch that never executed
                # reads as healthy silence.
                row.append(repr(node) if found else ABSENT)
            # Full timestamp, not the day: sorting by day alone makes the
            # newest-N fallback newest only at day granularity, so within the
            # boundary day the selection would be glob order (kimi-code, id=145).
            samples.append((str(rec.get("timestamp", "")), tuple(row)))
    return by_day, by_id, (samples, no_key)


def report_health(health):
    """Flag governance-consumed fields that do not vary *recently*.

    A constant is not evidence. The audit store recorded status="success" for
    76,292 of 76,292 records over six months — not because nothing failed, but
    because the post hook read `tool_output`/`tool_error`, keys Claude Code does
    not send (it sends `tool_response`). The store looked healthy the whole time:
    every record present, every record "success". Nothing checked whether the
    outcome field could take a second value, so nothing noticed the R6 Result was
    hardcoded by accident. This check is that missing question.

    It asks it over a trailing window rather than the whole history, because the
    whole history has a poison pill in it (kimi-code, 2026-07-26): the store's
    day-one manual test wrote the only real output_hash it has ever contained, so
    `output_hash` has two distinct values all-time and a census-style variance
    check waves it through. The same census would certify a field that worked
    once in January and died in February. Recency is the property that matters,
    so recency is what gets measured — and the all-time count is printed beside
    the window count so "varied, but not since the seed" stays legible instead of
    being quietly excluded.

    Three verdicts, deliberately distinct:
      DEGENERATE      — written often enough to judge, and never varies. The bug.
      NEVER WRITTEN   — the branch that writes it did not run. A dead code path
                        reads as silence, and silence is exactly what this store
                        returned for `agent_completion.success`: 794 Task calls,
                        every on_agent_spawn throwing on a stale ledger schema,
                        zero completions recorded, and nothing said a word.
      under-sampled   — too few writes in the window to conclude. Not a failure;
                        calling it one trains the operator to ignore the run.
    """
    samples, no_key = health
    if not samples:
        return True

    # Sorted by timestamp so the record-count fallback below really is the
    # *newest* N; the store is one file per session, so glob order is arbitrary
    # in time.
    samples.sort(key=lambda s: s[0])

    # CALENDAR cutoff, not the 14 most recent days *present in the store*.
    # The earlier version took days[-14], which denominates the window in
    # activity and labels it as time: on this store that reached 2026-05-11,
    # 76 calendar days back, because the store is sparse (108 active days over
    # six months, with a 40-day hole in June). A field that died two months ago
    # would still pass "varied in the last 14 days" — the poison pill returning
    # diluted rather than seeded (kimi-code, id=145).
    #
    # A calendar cutoff can leave too few records, and that is the point: the
    # newest-N fallback below already exists to say so out loud. Better to
    # confess the sparsity than to relabel it as recency.
    cutoff = (datetime.now(timezone.utc).date()
              - timedelta(days=WINDOW_DAYS)).isoformat()
    window = [row for stamp, row in samples if stamp[:10] >= cutoff]
    mode = f"last {WINDOW_DAYS} calendar days, since {cutoff}"
    if len(window) < MIN_WINDOW_RECORDS:
        # A quiet store still deserves an answer: widen to the newest N records
        # rather than reporting "insufficient data" on every field forever.
        # The span is printed because the fallback is only honest if the reader
        # can see how far back "newest N" actually had to reach.
        tail = samples[-MIN_WINDOW_RECORDS:]
        window = [row for _, row in tail]
        span = f"{tail[0][0][:10]}..{tail[-1][0][:10]}" if tail else "empty"
        mode = (f"newest {len(window)} records spanning {span}; "
                f"only {sum(1 for s, _ in samples if s[:10] >= cutoff)} in the "
                f"last {WINDOW_DAYS} calendar days")

    ok = True
    print("=== audit store health ===")
    print(f"audit records         : {len(samples)} all-time, {len(window)} in "
          f"window ({mode})")
    for i, (field, consumer) in enumerate(GOVERNED_FIELDS):
        win = Counter(row[i] for row in window if row[i] != ABSENT)
        present = sum(win.values())
        alltime = len({row[i] for _, row in samples if row[i] != ABSENT})
        print(f"   {field:26s} n={present:<6d} distinct={len(win)} "
              f"(all-time {alltime})  {dict(win.most_common(3))}")
        if present == 0:
            print(f"      NEVER WRITTEN: nothing produced this field in the "
                  f"window — {consumer} is not running")
            ok = False
        elif present < MIN_FIELD_SAMPLES:
            print(f"      under-sampled: {present} < {MIN_FIELD_SAMPLES} writes, "
                  f"not judged")
        elif len(win) < 2:
            only = next(iter(win), "?")
            extra = (f"; {alltime} values all-time, so its variation predates the "
                     f"window — a seed, not a signal" if alltime > 1 else "")
            print(f"      DEGENERATE: always {only} across {present} records — "
                  f"{consumer} is reading a constant{extra}")
            ok = False
    if no_key:
        print(f"   MISSING JOIN KEY   : {no_key} records without "
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
