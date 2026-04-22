# PinkyBot Daemon Adapter

This document describes a thin adapter model for connecting a PinkyBot-style daemon to Ethos runtime surfaces.

## Goal

Translate persistent companion-agent operations into approved Ethos runtime calls without collapsing the boundary between:

- persistent agent state
- runtime execution tools
- memory storage
- messaging adapters
- approval-gated actions

## Suggested adapter surfaces

### Agent registry bridge
Map named PinkyBot agents to approved local runtime profiles.

### Memory bridge
Expose only explicit durable-memory operations:
- reflect
- recall
- introspect

### Messaging bridge
Allow outbound messaging only through a permission-aware adapter.

### Scheduler bridge
Allow wake triggers to enqueue runtime work instead of directly executing privileged actions.

## Internal event shape

```json
{
  "agent": "pinkybot-companion",
  "source": "telegram",
  "trigger": "message",
  "action": "wake",
  "approval_required": false,
  "payload": {
    "content": "hello"
  }
}
```

## Guardrails

- never give the daemon unrestricted execution rights
- keep approvals explicit for external messaging, calendar writes, or sensitive exports
- treat model output as untrusted until validated
- log every daemon-to-runtime handoff

## First implementation target

A safe first adapter should support:
- create / wake / chat lifecycle docs
- Telegram inbound message wake events
- memory reflection and recall
- activity logging
- no destructive or financial actions
