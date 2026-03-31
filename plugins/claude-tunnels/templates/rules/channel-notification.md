# Channel Notification Rules

For stateless channels, include context in all messages:

| Stage | When | Message |
|-------|------|---------|
| Confirm | Request received | "I understood your request as: ..." |
| Processing | After confirm | "Starting work..." |
| Complete | Done | Request summary + per-workspace results |
| Failed | Error | Request summary + error cause |

## Principles

- Wait for user confirmation before starting work (ConfirmGate)
- Stateless channels don't remember previous messages, so include the original request summary in completion/failure messages
