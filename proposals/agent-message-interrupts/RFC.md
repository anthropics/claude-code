# RFC: Agent Message Interrupts

**Status:** Proposal  
**Author:** Community contribution  
**Target:** `src/services/tools/toolOrchestration.ts`, `src/tasks/LocalAgentTask/LocalAgentTask.tsx`, `src/tools/SendMessageTool/SendMessageTool.ts`, `src/query.ts`, `src/utils/messages.ts`

## Problem

When a subagent is executing a batch of tool calls, messages sent via `SendMessage` are queued in `pendingMessages[]` and only drained **after ALL tools in the batch complete**, during the attachment phase. This creates a frustrating delay:

```
API response -> [tool_use_1, tool_use_2, tool_use_3, tool_use_4, tool_use_5]
                    |            |            |            |            |
                 execute      execute      execute      execute      execute
                                  ^
                                  |
                        SendMessage("stop, wrong approach")
                        -> queued, invisible until tool_use_5 finishes
```

For serial tool batches (writes, edits, bash commands), each tool can take seconds to minutes. An agent given 5 serial file edits cannot be redirected until all 5 complete, even if the coordinator sends a correction after the first one.

This is the single most operationally painful gap in the coordinator/agent architecture. The coordinator can see the agent is wrong, sends a message, and then watches it continue being wrong for 4 more tool calls.

## Solution

Three layers of interrupt, from lightweight to aggressive:

### Layer 1: Cooperative check between serial tool calls

In `runToolsSerially()`, after each tool completes and before the next begins, peek at `pendingMessages`. If non-empty, cancel remaining tools with `is_error` results and return early. The normal attachment phase then drains and delivers the messages on the very next API turn.

**Cost:** One `getAppState()` call per serial tool boundary. Zero cost for agents with no pending messages (the common case). Zero cost for the main thread (guarded by `agentId` check).

### Layer 2: Cooperative check between batch boundaries

Same check in the outer `runTools()` loop between partitioned batches. Catches messages that arrive during a concurrent read-only batch, before an expensive serial batch begins.

### Layer 3: Urgent abort for long-running individual tools

New `urgent: boolean` field on `SendMessage`. When set, after queueing the message, fires `abortController.abort('message_interrupt')` on the target agent. The query loop recognizes this as a special abort reason: skips the generic interruption message, resets the abort controller, and falls through to the attachment phase. The agent continues running with a fresh controller.

## What the agent sees

```
tool_result (tool 1): { actual result }
tool_result (tool 2): { actual result }
tool_result (tool 3): [is_error] "Tool execution interrupted: a message was received
                       from the coordinator. Remaining tool calls in this batch were
                       skipped. The message will be delivered as an attachment."
tool_result (tool 4): [is_error] (same)
attachment: "Stop working on X, pivot to Y instead"
```

The agent can re-issue cancelled tools if still relevant, or pivot to the new directive.

## Design Decisions

**Why not inject messages mid-tool-result sequence?**  
The API requires all `tool_result` blocks for every `tool_use` in an assistant message. We can't insert a user message between them. The only option is to provide error results for skipped tools and deliver the message as an attachment after the results.

**Why peek instead of drain?**  
`hasPendingMessages()` is non-draining. The actual drain happens at the normal attachment phase in `getAgentPendingMessageAttachments()`. This preserves the single-drain-point invariant and avoids duplicating drain logic.

**Why reset the abort controller instead of creating a child?**  
The `message_interrupt` abort is cooperative, not terminal. The agent should continue running. A fresh `AbortController` is the simplest way to achieve this without introducing a new signal type. The child abort controller hierarchy (parent abort -> children abort) is preserved because the parent's controller is unaffected.

**Why only check between serial tools (not mid-concurrent)?**  
Concurrent batches are read-only operations that typically complete fast. Interrupting them mid-flight would require cancelling in-progress promises and is high complexity for low value. The batch boundary check covers the transition from concurrent-to-serial, which is the common case.

## Files Changed

| File | Change |
|------|--------|
| `tasks/LocalAgentTask/LocalAgentTask.tsx` | +`hasPendingMessages()` non-draining peek function |
| `utils/messages.ts` | +`PENDING_MESSAGE_INTERRUPT` constant, +`createToolResultInterruptMessage()` |
| `services/tools/toolOrchestration.ts` | Interrupt checks at batch boundaries and between serial tools |
| `tools/SendMessageTool/SendMessageTool.ts` | +`urgent` field in input schema, abort on urgent |
| `query.ts` | `message_interrupt` abort reason handling: reset + continue |

## Patches

See the `patches/` directory for file-level diffs against the internal source tree.
