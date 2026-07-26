#!/usr/bin/env python3
"""Diff the ledger's declared schema against the live one, and optionally close it.

Why this exists: `_init_db()` issues `CREATE TABLE IF NOT EXISTS`. Against a
database created by an older version of the same file, every one of those
statements is a no-op — the table exists, so the new column list is discarded
without a word. The schema in the code and the schema on disk then diverge
permanently, and nothing ever says so.

That is not hypothetical here. `audit_trail` gained `sequence`, `previous_hash`
and `record_hash` when the witnessing chain was added. The live table on this
machine has none of them, so `record_audit()` — which orders by `sequence` to
find the previous record — has raised

    sqlite3.OperationalError: no such column: sequence

on every call since. `AgentGovernance.on_agent_spawn()` calls it, the pre hook
wraps that call in `except Exception`, and the hook writes the message into the
R6 decision record and carries on. The result, measured 2026-07-26:

    Task decisions in ~/.web4/r6   : 794
    with agent block == error      : 794   ("no such column: sequence")
    rows in audit_trail            : 0
    agent_completion in ~/.web4/audit : 0 of 76,292 records

`session["active_agent"]` is assigned *after* the throwing call, so it stayed
None, so the post hook's `on_agent_complete()` branch never ran. Agent trust
governance has never executed — not once, on any machine using this ledger.

The failure was recorded 794 times in a store nothing read until 2026-07-26.
This script is the reader for the other store.

Read-only by default. `--apply` adds missing columns (ADD COLUMN, nullable —
SQLite cannot add a NOT NULL column without a default, and inventing one would
be worse than a NULL that reads as "written before the chain existed").
Divergences ADD COLUMN cannot express — a column the live table has and the code
does not, or a type change — are reported and left alone; those need a rebuild
and a human.

Usage:
    ledger_migrate.py            # report; exit 1 if the schemas differ
    ledger_migrate.py --apply    # add the missing columns, then re-report
"""

import sqlite3
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from governance.ledger import Ledger  # noqa: E402

LIVE = Path.home() / ".web4" / "ledger.db"


def schema_of(db_path):
    """{table: {column: type}} for one database."""
    out = {}
    conn = sqlite3.connect(db_path)
    try:
        for (name,) in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name NOT LIKE 'sqlite_%'"
        ):
            out[name] = {
                row[1]: row[2] for row in conn.execute(f"PRAGMA table_info({name})")
            }
    finally:
        conn.close()
    return out


def declared_schema():
    """What _init_db() builds on an empty file — the code as source of truth.

    Deriving this by running the real initialiser rather than restating the
    column lists here is the point: a hand-copied expectation is one more thing
    that can silently drift from the code it claims to check.
    """
    with tempfile.TemporaryDirectory() as tmp:
        ref = Path(tmp) / "reference.db"
        Ledger(db_path=ref)
        return schema_of(ref)


def main(argv):
    apply = "--apply" in argv
    if not LIVE.exists():
        print(f"{LIVE}: no ledger — nothing to migrate (a fresh one will be "
              f"created with the current schema)")
        return 0

    want, have = declared_schema(), schema_of(LIVE)
    missing_tables = sorted(set(want) - set(have))
    added, unfixable = [], []

    print(f"=== ledger schema: {LIVE}")
    for table in sorted(want):
        if table not in have:
            print(f"   {table:20s} MISSING TABLE (CREATE IF NOT EXISTS will "
                  f"build it on next open)")
            continue
        missing = [c for c in want[table] if c not in have[table]]
        extra = [c for c in have[table] if c not in want[table]]
        state = "ok" if not missing and not extra else "DIVERGED"
        print(f"   {table:20s} {state}  ({len(have[table])} live / "
              f"{len(want[table])} declared)")
        for col in missing:
            print(f"      missing column: {col} {want[table][col]}")
        for col in extra:
            print(f"      column not in code: {col} {have[table][col]} "
                  f"(left alone — ADD COLUMN cannot remove it)")
            unfixable.append((table, col))
        if missing and apply:
            conn = sqlite3.connect(LIVE)
            try:
                for col in missing:
                    conn.execute(
                        f"ALTER TABLE {table} ADD COLUMN {col} {want[table][col]}"
                    )
                    added.append(f"{table}.{col}")
                conn.commit()
            finally:
                conn.close()

    if apply and added:
        print(f"\napplied: added {len(added)} column(s): {', '.join(added)}")
        have = schema_of(LIVE)

    diverged = missing_tables or any(
        set(want[t]) - set(have.get(t, {})) for t in want
    ) or unfixable
    print("\nverdict               :",
          "schema matches code" if not diverged else "SCHEMA DIVERGED FROM CODE")
    if diverged and not apply:
        print("run with --apply to add the missing columns")
    return 1 if diverged else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
