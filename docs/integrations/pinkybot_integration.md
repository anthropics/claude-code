# PinkyBot Integration

This document describes how to integrate **PinkyBot** into the Ethos Aegis ecosystem as a persistent companion-agent layer.

## Intent

PinkyBot adds a long-lived personal agent surface on top of the existing Ethos runtime work:

- persistent named agents
- long-term memory
- scheduled wake cycles
- multi-platform messaging
- dashboard-driven management
- skills-based extensibility

## Role in the Ethos stack

- **Ethos Aegis** = core architecture umbrella
- **Claude Mythos** = runtime and scaffold layer
- **Veriflow** = host-aware reasoning and CKAN intelligence
- **Celestial Agent** = trust-layer identity for encrypted policy packs
- **PinkyBot** = persistent companion and outreach layer

## Recommended boundary

PinkyBot should not replace the core runtime. It should sit above it as a companion framework that can:

1. wake agents on schedules or inbound events
2. route messages from Telegram, Slack, or Discord
3. persist cross-session memory
4. call into approved Ethos runtime tools
5. present a dashboard view over agent status and activity

## Suggested integration points

### Messaging
- Telegram bot token managed in settings
- Slack bot token managed in settings
- Discord bot token managed in settings
- outbound messaging routed through a dedicated MCP surface

### Memory
- persistent memory should remain explicit and auditable
- store only approved long-term state
- separate working state from durable memory

### Skills
- represent PinkyBot capabilities as skill modules
- allow companion agents to install task-specific skills
- keep skills permission-scoped and reviewable

### Scheduling and triggers
- webhook wakes
- URL watcher wakes
- file watcher wakes
- heartbeat / dream cycles

## Non-goals

- unrestricted automation
- hidden access to user accounts
- bypassing approval gates for sensitive actions
- uncontrolled message sending

## Recommended first implementation steps

1. add a PinkyBot companion skill surface
2. add a PinkyBot agent profile example
3. add Telegram Mini App event mapping notes
4. add a thin API adapter document for daemon integration
5. keep runtime repair and feature expansion work separate from companion integration
