# Demo Data Handling (MANDATORY)

Demo data coexists with production data but auto-filters once real work begins.

---

## Auto-Filtering

| Production Data Exists? | Demo Data Behavior |
|------------------------|-------------------|
| **No** | Include, mark as `[DEMO]` |
| **Yes** | **Exclude by default** |

Override: `--include-demo` (always show), `--demo-only` (testing/learning).

## Identification

Demo content: located in `context/demo/`, ID contains "DEMO", or contains `[DEMO DATA]` marker. In `index.json`: `"demo": true`.

## Display

When shown: prefix with `[DEMO]`. When excluded: show count of excluded results with hint to use `--include-demo`.

## Skills That Must Apply

`/context-recall`, `/feedback-recall`, `/portfolio-status`, `/relevant-learnings`

---

## V2V Operating Principle

> "Demo data is training wheels. Once you're riding, they should automatically retract—but remain available if you need to practice again."
