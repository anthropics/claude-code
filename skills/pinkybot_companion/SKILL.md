# PinkyBot Companion

## Purpose

Provide a persistent companion-agent surface for Ethos Aegis using PinkyBot-style behavior:

- persistent identity
- long-term memory
- wake scheduling
- messaging adapters
- dashboard-compatible agent state

## Capabilities

- receive inbound messages from approved platforms
- wake on explicit triggers
- reflect and recall durable memory
- summarize project state for the operator
- request approval before external or sensitive actions

## Inputs

- messages
- schedules
- webhook payloads
- file-change events
- URL watcher diffs

## Guardrails

- no hidden message sending
- no approval bypass for sensitive actions
- no persistent storage of secrets in plain text
- memory writes must be explicit and reviewable

## Suggested tools

- pinky-memory
- pinky-self
- pinky-messaging
- pinky-calendar
- Ethos runtime tools only where explicitly approved

## Operator expectation

Treat this as a companion layer, not as an unrestricted controller over the wider system.
