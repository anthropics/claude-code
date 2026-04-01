# Arsenal Reliability Plugin for oh-my-claudecode

Add production-grade LLM agent reliability to Claude Code in one command.

## Install

```
/plugin marketplace add https://github.com/darshjme/arsenal-omc-plugin
/plugin install arsenal-reliability
```

## What You Get

6 reliability skills for Claude Code:

| Skill | What it does |
|-------|-------------|
| `/arsenal-circuit-break` | Wrap any LLM call with a circuit breaker |
| `/arsenal-retry` | Add exponential backoff + jitter retry |
| `/arsenal-trace` | Add distributed tracing to agent pipeline |
| `/arsenal-validate` | Validate LLM output schema before downstream use |
| `/arsenal-rate-limit` | Add rate limiting to prevent API bans |
| `/arsenal-audit` | Full reliability audit of existing agent code |

## Quick Example

Ask Claude Code:
```
Add circuit breaking to my LLM call so it fails fast when the provider is down
```

Claude Code will add kavacha (Arsenal's circuit breaker) with zero external dependencies.

## Arsenal

100 Python reliability libraries. 4,375 tests. Zero external dependencies. MIT licensed.

→ https://github.com/darshjme/arsenal

Built by [Darshankumar Joshi](https://github.com/darshjme) — AI Agent Reliability Engineer.
