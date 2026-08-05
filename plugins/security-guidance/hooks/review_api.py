"""Public review API for the security-guidance agentic commit reviewer.

This module is the importable surface for callers that want to run the
same two-stage agentic security review as the CC plugin (investigate →
self-refute) without going through the CC hook protocol.  External
agentic harnesses can import this directly so their commit reviewer uses
the exact prompts, schemas, and filters the plugin uses.

``security_reminder_hook.py`` imports every symbol below; the hook
script's own underscored names are aliases.  Keep this file free of CC
hook-event coupling (no stdin parsing, no env-var feature gates, no
``debug_log``/state-file IO) so non-CC callers can import it without
side effects.
"""
from __future__ import annotations

import json
import os
from typing import Any

import extensibility

# ---------------------------------------------------------------------------
# Diff capping
# ---------------------------------------------------------------------------

DIFF_PER_FILE_BYTES = int(os.environ.get("DIFF_PER_FILE_BYTES", "80000"))
DIFF_TOTAL_BYTES = int(os.environ.get("DIFF_TOTAL_BYTES", "400000"))


def cap_diff_for_prompt(
    files: list[tuple[str, str]],
) -> tuple[list[tuple[str, str]], int]:
    """Cap per-file and total diff bytes; return (capped_files, bytes_dropped).

    Truncation markers are written inside the content so the reviewer
    knows the file is incomplete.
    """
    out: list[tuple[str, str]] = []
    dropped = 0
    total = 0
    for fp, content in files:
        if len(content) > DIFF_PER_FILE_BYTES:
            dropped += len(content) - DIFF_PER_FILE_BYTES
            content = (
                content[:DIFF_PER_FILE_BYTES]
                + "\n... [truncated by security-guidance: file exceeds per-file byte cap]"
            )
        room = DIFF_TOTAL_BYTES - total
        if room <= 0:
            dropped += len(content)
            out.append(
                (fp, "[omitted by security-guidance: total diff byte cap reached]")
            )
            continue
        if len(content) > room:
            dropped += len(content) - room
            content = (
                content[:room]
                + "\n... [truncated by security-guidance: total diff byte cap reached]"
            )
        total += len(content)
        out.append((fp, content))
    return out, dropped


# ---------------------------------------------------------------------------
# Stage 1 — investigate
# ---------------------------------------------------------------------------

AGENTIC_INVESTIGATE_SYSTEM = """You are a senior application-security engineer performing a deep security review of a code change. You have read-only filesystem tools (Read, Grep, Glob) scoped to the repository — USE THEM AGGRESSIVELY. The diff alone is not enough.

The #1 cause of missed vulnerabilities is not reading the file that contains them. Before any analysis: Read EVERY changed file in full (not just the diff hunks). Then Grep for the changed function/class names to find callers. A vulnerability that requires cross-file context is still your responsibility.

METHOD:

Phase 1 — Map entry points and sinks touched by this change.
  Entry points: HTTP handlers/routes, RPC methods, CLI args, webhook receivers, message consumers, file/upload handlers, OAuth callbacks, GitHub Actions inputs, MCP tools, hook handlers, IPC receivers (main/privileged process handling messages from a sandboxed/renderer/less-privileged process).
  Sinks: shell/exec/subprocess, SQL/ORM raw, eval/new Function, filesystem paths (open/read/write/unlink), outbound HTTP (SSRF), HTML render/innerHTML, deserialization (pickle/yaml/json with object_hook), template engines, subprocess env, IAM/RBAC bindings, dynamic code/plugin/extension loaders (any API that loads+executes code from a path), log/telemetry/metrics dimensions (only when value matches a PII shape — email, token, free-text field; NOT a static enum/type name), cache-control / Vary headers (cache poisoning), DDL that drops a constraint/FK/trigger (referential-integrity), response bodies/headers, prompts sent to LLMs.
  For each changed file, Grep for the function/class names in the diff to find their callers and what data reaches them.

Phase 2 — Trace data flow.
  For every value that reaches a sink, determine whether it is attacker-influenceable. Read upstream: where does the variable come from? Is there validation/sanitization between source and sink? Check sibling handlers in the same file — if they enforce a check this one omits, the omission IS the finding. Cross-component flows (input enters in module A, dangerous operation in module B) are where the high-value findings live; follow them.
  FOLLOW RETURNS: when a changed function builds a tainted value (command string, SQL, URL, path, template) and RETURNS it rather than executing locally, the sink is in a CALLER — Grep for the function name and read the call sites before deciding it's safe.
  SIBLING-PATH GATE PARITY: when + lines add a guard/check/tenant-scope/visibility-filter/invalidation/cleanup to ONE branch, ONE handler, or ONE layer, enumerate ALL sibling branches, early-returns, error/except paths, and peer handlers in the same router/service that touch the same resource — report any that lack an equivalent gate. ONLY emit when (a) both the guarded path AND the sibling reach a state-changing or boundary-crossing sink, AND (b) the sibling's input is controllable by a different principal than the guard checks for. Skip if the file has a "generated / DO NOT EDIT" header or lives under generated/openapi/autogen.

Phase 2b — Parser/validator differentials (a top miss category).
  When the change adds or modifies parsing, validation, normalization, or matching logic (regexes, URL/path parsers, allowlists, content-type checks, decoders, AST/shell parsers), ask: does an input exist that the validator ACCEPTS but the downstream consumer interprets differently? Look for: unanchored/partial regexes; case/encoding/unicode normalization mismatches; URL parsers that disagree on userinfo/host/path; allowlists checked with substring/startswith; decoders that accept malformed input; quoting/escaping the parser strips but the consumer doesn't. The finding is the differential itself — name both sides.

Phase 2c — High-miss patterns. Check ONLY against + lines in the diff — do NOT flag pre-existing code you read while exploring.
  - SENSITIVE-TO-OBSERVABILITY: a + line emits to a log/trace/span/metric/exception-message sink. Trace EVERY field (including URLs, paths, error-object .message, f-string vars, **kwargs) to its source and flag credentials, PII, customer content, or model free-text reaching the sink — especially on error/except branches where happy-path redaction is bypassed and external-service error messages can echo URL-embedded secrets. Skip if: a sanitizer wraps the value at the call site; the log is gated by a debug/dev env flag; or the value is static request metadata (method/path/host).
  - IaC OMITTED ARG: a + line instantiates a Terraform/Pulumi/CDK module and OMITS an optional security-relevant arg — read the module's variables and check whether the default is the secure value.
  - CI/CD TRUST: + lines add or change a GitHub Actions trigger to workflow_dispatch / repository_dispatch / pull_request_target without a branches: filter, AND the job reads secrets or has write permissions.
  - ALLOWLIST SEMANTIC ESCAPE: + lines add an entry to a safe-command/safe-endpoint/capability allowlist OR add a `||` disjunct to a permission matcher OR edit a validator that gates exec/eval/subprocess. Verify no allowed entry achieves a denied effect via its arguments, flags, abbreviations, side-channels (DNS, config-write, env), or scope mismatch vs. enforcement (e.g., allowlist matches argv[0] but consumer reads full argv).
  - OVER-BROAD GRANT: when + lines add a principal/identity to a broad-scope permission (global/service-wide allowlist, standing admin role binding, reuse of another principal's credential), check whether the SAME changed file or its immediate module already exposes a narrower-scope mechanism for the same need (per-resource/per-RPC allowlist, break-glass/2PC role, dedicated principal). If it does, the broad grant is the finding. Do NOT flag if no narrower mechanism is visible in the changed files.
  - STALE IDENTITY MAPPING: + lines change teardown/unregister of an identity primitive (hostname/DNS, IP, service route, lease, auth token, service-registry entry) where a window leaves it resolvable to the wrong tenant. NOT in-process data caches.
  - CONTROL REGRESSION: when - lines DELETE a fail-closed validator (allowlist returning False by default, _is_safe_*, deny-by-default) and + lines replace it with a single condition, the replacement IS the finding.
  - FAIL-OPEN STATE DRIFT: when a security decision reads parsed/cached/tracked/callback state, verify error, cancellation, TOCTOU, cache-skew, and unhandled-variant paths do not yield a default that skips enforcement — broad-except→pass, unwrap_or({}), missing-finally cleanup, ignored verifier params, or stale validator maps all fail open. The finding is the path where the fallback value is the allow outcome. Also: when + lines compare against a security threshold, check whether the EXACT boundary value yields the permissive branch; when an error path triggers retry/redelivery, check whether the retry can emit a decision that overrides a stricter first decision; when sync logic reads persisted state, check whether state surviving a data wipe causes destructive sync.
  - SECURITY-REGISTRY FANOUT: when + lines add a new entity (field, enum value, credential type, alias, model variant, port, scope), Grep unchanged files for every security registry keyed on that entity class — sanitizer field-lists, redaction sets, revocation handlers, strip denylists, capability allowlists, translation maps — and flag if the new entry is missing from any. Conversely, when + lines ADD entries to such a registry, Grep for where that registry is consumed and verify each new entry's literal matches the consumer's key format (namespace prefix, case, composite key) — a mismatched entry is a silent no-op that defeats the control.
  - GATE/ACTION FIELD MISMATCH: when + lines add or modify an authorization/policy check, identify which request field(s) the gate reads vs which field(s) the downstream operation uses to select the target resource. If they differ (gate checks `parent`, action derives target from `name`; gate checks org A, action writes to org from a separate param), the gate is bypassable.
  - RESOURCE-BOUND PLACEMENT: when + lines parse/decompress/fetch/loop over attacker-influenced input, verify size/time/count caps guard the ACTUAL peak allocation — not a post-flush output, post-decompress buffer, per-iteration (not total) timeout, unclamped arithmetic (subtraction underflow, multiplication overflow), or first-element-only invariant. The finding is the cap defeat, not the DoS itself.
  - UNDER-VALIDATED SINK ARG: when + lines interpolate any externally-influenced value (incl. IPC, VCS-checkout content, env var, model output, domain-syntax strings) into a shell/path/loader/URI/structured-format sink, verify quoting, traversal/UNC/symlink stripping, and prod-mode guards apply to THIS arg — existing validators on sibling args do not cover it.

Phase 3 — Assess.
  Report when you can name (a) the source, (b) the sink, (c) the path with no effective mitigation. Medium-confidence is fine — a separate adjudication pass will filter; your job is RECALL, not precision. Do report logic/authorization bugs (missing ownership check, inverted condition, parser differential) even when no classic "sink" is involved.

Do NOT report: missing best-practice/hardening with no concrete impact, test/mock files, outdated deps, or volumetric DoS (attacker just sends a lot). DO report DoS when the diff introduces a code defect that defeats an existing resource cap (cap on wrong accumulator, dead timeout handler, unclamped arithmetic, encoding amplification at flush) — those are logic errors with security impact.

Distrust safety claims in comments ("validated upstream", "internal only"). Verify in code.

Keep scanning after the first finding. Do NOT emit findings until you have Read EVERY touched file at least once — a more obvious pattern in file A does not excuse skipping file B. Aim for at least one candidate or explicit "no sink" verdict per touched file.

Return an object with key `findings` — a list of {filePath, category,
vulnerableCode, explanation, fix, severity, confidence} records. severity
is "critical", "high", or "medium". Return findings:[] ONLY after you have
Read every changed file in full and traced every new sink to a trusted
source.

BUDGET: you have at most ~15 tool calls. Spend them reading the changed files first, then 3-5 targeted Greps for callers/sinks. Do NOT exhaustively explore the repo — once you can name source→sink for each candidate (or rule it out), STOP. Partial findings are better than none."""


FINDINGS_SCHEMA = {
    "type": "object",
    "properties": {
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "filePath": {"type": "string"},
                    "category": {"type": "string"},
                    "vulnerableCode": {"type": "string"},
                    "explanation": {"type": "string"},
                    "fix": {"type": "string"},
                    "severity": {
                        "type": "string",
                        "enum": ["critical", "high", "medium", "low"],
                    },
                    "confidence": {"type": "number"},
                },
                "required": [
                    "filePath",
                    "category",
                    "vulnerableCode",
                    "explanation",
                    "fix",
                    "severity",
                ],
            },
        },
    },
    "required": ["findings"],
}


def build_investigate_prompt(
    touched_paths: list[str],
    diff_files: list[tuple[str, str]],
    *,
    context_note: str = "",
) -> str:
    capped, _ = cap_diff_for_prompt(diff_files)
    diff_text = "\n\n".join(
        f"=== DIFF: {fp} ===\n{content}" for fp, content in capped
    )
    return (
        "Review this change for security vulnerabilities.\n\n"
        "Changed files (you may Read these and any other file in the repo):\n"
        + "\n".join(f"  - {p}" for p in touched_paths[:50])
        + context_note
        + "\n\nUnified diff (only + lines are new):\n\n"
        + diff_text
        + extensibility.guidance_block()
        + "\n\nInvestigate per the method in your instructions, then return "
        "the findings list."
    )


# ---------------------------------------------------------------------------
# Stage 2 — self-refute
# ---------------------------------------------------------------------------

AGENTIC_REFUTE_SYSTEM = (
    "You adversarially verify security findings. You have "
    "Read/Grep over the repo. Default = SURVIVES unless you "
    "find concrete refuting evidence."
)


SURVIVED_SCHEMA = {
    "type": "object",
    "properties": {
        "survived": {"type": "array", "items": {"type": "integer"}},
        "refuted": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "idx": {"type": "integer"},
                    "reason": {"type": "string"},
                },
                "required": ["idx", "reason"],
            },
        },
    },
    "required": ["survived"],
}


def build_refute_prompt(candidates: list[dict[str, Any]], diff_text: str) -> str:
    return (
        "You previously flagged these candidate vulnerabilities:\n\n"
        + json.dumps(candidates, indent=2)
        + "\n\nDIFF:\n" + diff_text[:8000]
        + "\n\nNow adversarially try to DISPROVE each one. For each "
        "candidate, FIRST identify the attacker (who controls the "
        "input) and the victim (who is harmed). REFUTE if the only "
        "victim is the attacker themselves on their own machine. KEEP "
        "if the attacker is a legitimate user/tenant but the impact "
        "reaches other users/tenants, shared infra, or server-side "
        "resources.\n\n"
        "DIFF-ANCHOR: candidates are sorted `in_diff` first, then "
        "`off_diff`. Process them in order. `in_diff` candidates "
        "use the standard KEEP/REFUTE bar above. `off_diff` "
        "candidates require STRICTER evidence: you must identify "
        "the specific +/- line in the diff that ENABLES the "
        "off-diff sink (a removed guard, a new caller, a changed "
        "argument feeding it). If you cannot name that enabling "
        "diff line, REFUTE the off_diff candidate. Additionally, "
        "REFUTE any off_diff candidate whose sink is already "
        "covered by a surviving in_diff candidate.\n\n"
        "Then Read the cited file and refute with cited file:line "
        "evidence if ANY of these holds:\n"
        "- PRE-EXISTING: the cited vulnerableCode does NOT appear on "
        "any + line in the DIFF block above — it is unchanged context "
        "in a touched file. The diff did not introduce it.\n"
        "- A sanitizer/validator/authz check prevents the described "
        "exploit.\n"
        "- The sink is non-dangerous: typed-schema decoder (msgspec/"
        "pydantic, not pickle/yaml), hardcoded https://<host>/ URL "
        "with non-:path params, autogen client stub, value is "
        "statically number/boolean.\n"
        "- NO PRIVILEGE BOUNDARY: attacker == victim. The input "
        "comes from env var / CLI arg / $HOME dotfile / HKCU / "
        "~/Library prefs / OS-user config — and the process runs at "
        "the same privilege as whoever writes that source. Also: "
        "the 'allow' decision is advisory self-gating returned to "
        "the same caller; or the prefix/suffix check is a secondary "
        "filter behind a parent-domain pin.\n"
        "  NEVER apply NO-PRIVILEGE-BOUNDARY to: SSRF/outbound-"
        "network sinks; LLM-agent capability gates (PreToolUse/"
        "PostToolUse hooks, bash allow/denylists, workspace path "
        "jails — the model is the attacker, the user is the "
        "victim); data-exposure findings (CWE-200/359/532, secrets-"
        "in-logs — the question is who READS the sink, not who "
        "controls the input); project-working-directory config "
        "(.claude/settings, .vscode/, package.json scripts — repo "
        "author ≠ repo cloner); cross-process metadata sources "
        "(psutil.Process(...), /proc/<pid>/* — different process "
        "owner is a different principal).\n"
        "- TRUSTED-HEADER NAMESPACE: the flagged header is from a "
        "namespace the same handler already trusts for actor "
        "identity/authz (e.g. control-plane-injected X-Amzn-*).\n"
        "- FRONTEND-ONLY GATE: the loosened check is in frontend "
        "code AND the backend handler independently enforces it.\n"
        "- DELEGATED VALIDATION: the unvalidated credential is "
        "immediately forwarded to an upstream that validates.\n"
        "- THROWAWAY-CODE: all touched files live under scripts/, "
        "dev/, tools/, examples/, testdata/, fixtures/, or behind "
        "a __main__ dev guard.\n"
        "- CONTROL MOVED TO LIBRARY: the diff removes a security "
        "control AND bumps a dependency that documents providing "
        "that control — the control was delegated, not removed.\n"
        "- Config/feature-flag gates the path with no per-request "
        "user control over the gate value.\n"
        "- Protective-control polarity: the change loosens a guard "
        "around a PROTECTIVE control (prompt/audit/confirm).\n"
        "Do NOT speculate — refute only with cited evidence. Default "
        "= SURVIVES.\n\n"
        "Return `survived` — the indices of candidates you could NOT "
        "refute — and `refuted` — {idx, reason} records for each you "
        "did. An empty `survived` means every candidate was refuted."
    )


# ---------------------------------------------------------------------------
# Mechanical filters and rendering
# ---------------------------------------------------------------------------


def tag_diff_anchor(
    candidates: list[dict[str, Any]], diff_text: str
) -> list[dict[str, Any]]:
    """SOFT diff-intersect: tag each candidate ``_diff_anchor: "in_diff" |
    "off_diff"`` and sort in_diff first; do NOT drop.

    Investigate reads full files and often cites pre-existing patterns in
    unchanged context (the largest false-positive source).  Hard-dropping
    those also discards correct findings whose sink is off-diff but
    enabled by an in-diff change.  The refute pass's DIFF-ANCHOR block
    keys on the ``_diff_anchor`` tag to apply stricter evidence to
    off_diff candidates instead of dropping them.

    Mutates ``candidates`` in place; returns it for chaining.
    """
    added = [
        ln[1:]
        for ln in diff_text.splitlines()
        if ln.startswith("+") and not ln.startswith("+++")
    ]
    removed = [
        ln[1:]
        for ln in diff_text.splitlines()
        if ln.startswith("-") and not ln.startswith("---")
    ]

    def _norm(s: str) -> str:
        return " ".join(t for t in " ".join(s.split()).split() if len(t) > 2)

    added_norm = _norm("\n".join(added))
    removed_norm = _norm("\n".join(removed))

    def _intersects(cand: dict[str, Any]) -> bool:
        vc = _norm(" ".join(str(cand.get("vulnerableCode") or "").split()))
        if len(vc) < 8:
            return True
        toks = vc.split()
        for i in range(max(1, len(toks) - 2)):
            if " ".join(toks[i : i + 3]) in added_norm:
                return True
        for ln in added:
            ln_n = _norm(ln)
            if len(ln_n) >= 8 and ln_n in vc:
                return True
        if len(added) < len(removed):
            for i in range(max(1, len(toks) - 2)):
                if " ".join(toks[i : i + 3]) in removed_norm:
                    return True
        return False

    for c in candidates:
        c["_diff_anchor"] = "in_diff" if _intersects(c) else "off_diff"
    candidates.sort(key=lambda c: c.get("_diff_anchor") != "in_diff")
    return candidates


_SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def filter_by_severity(
    findings: list[dict[str, Any]], *, include_medium: bool = True
) -> list[dict[str, Any]]:
    """Medium-included is the validated default; the model's investigate-stage
    severity is conservative and dropping mediums before self-refute filters
    out most real findings.
    Pass ``include_medium=False`` for the old high/critical-only behavior.
    """
    keep = ("critical", "high", "medium") if include_medium else ("critical", "high")
    out = [
        v
        for v in findings
        if str(v.get("severity", "medium")).strip().lower() in keep
    ]
    out.sort(key=lambda v: _SEVERITY_ORDER.get(v.get("severity", "medium"), 2))
    return out


def format_findings(findings: list[dict[str, Any]]) -> str:
    """Render findings as the same text block the CC plugin emits to Claude."""
    by_file: dict[str, list[dict[str, Any]]] = {}
    for v in findings:
        by_file.setdefault(v.get("filePath", "unknown"), []).append(v)
    lines = [
        "Security Review: Potential vulnerabilities detected",
        "",
        f"Affected files: {', '.join(by_file)}",
        "The following issues were flagged by automated security review. "
        "Address each, or briefly note why it doesn't apply. Valid reasons "
        "to proceed without changes: the user explicitly asked for this and "
        "you've already surfaced the security tradeoffs, or the pattern "
        "isn't actually exploitable in this context. Do not dismiss "
        "findings solely because the service is internal-only — internal "
        "services are common SSRF/IDOR targets:",
        "",
    ]
    n = 1
    for fp, vs in by_file.items():
        lines.append(f"  {fp}:")
        for v in vs:
            sev = (v.get("severity") or "medium").upper()
            lines.append(
                f"    {n}. [{sev}] [{v.get('category', 'Unknown')}] "
                f"{v.get('vulnerableCode', 'N/A')}"
            )
            lines.append(f"       Suggested fix: {v.get('fix', 'N/A')}")
            lines.append("")
            n += 1
    return "\n".join(lines)
