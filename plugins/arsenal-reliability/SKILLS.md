# Arsenal Reliability Skills — Registry

This file is the skill registry for oh-my-claudecode. Each entry maps a slash command to a SKILL.md.

## Skills

| Command | Skill File | Library | Description |
|---|---|---|---|
| `/arsenal-circuit-break` | `skills/circuit-break/SKILL.md` | `kavacha` | Circuit breaker — trip after N failures, auto-recover |
| `/arsenal-retry` | `skills/retry/SKILL.md` | `punarjanma` | Retry with exponential backoff + full jitter |
| `/arsenal-trace` | `skills/trace/SKILL.md` | `anusarana` | Distributed tracing for agent pipelines |
| `/arsenal-validate` | `skills/validate/SKILL.md` | `pariksha` | Output validation: schema, PII, format guard |
| `/arsenal-rate-limit` | `skills/rate-limit/SKILL.md` | `maryada` | Rate limiting: token bucket, per-key, async |
| `/arsenal-audit` | `skills/audit/SKILL.md` | (all) | Full reliability audit of existing code |

## Install All Libraries

```bash
pip install kavacha punarjanma anusarana pariksha maryada
```

## Quick Reference

```
kavacha    = armour       → circuit breaker
punarjanma = rebirth      → retry + jitter
anusarana  = tracing      → distributed spans
pariksha   = examination  → output validation
maryada    = boundary     → rate limiting
```

All from Arsenal: https://github.com/darshjme/arsenal
100 libraries. 4375 tests. Zero external dependencies. MIT license.
