# Proposed Fix: TUI Input Latency Degradation during Workflows

This document outlines the proposed technical solution to address issue **#82984** (`[BUG] Interactive input latency degrades to unusable well before the 1000-agent workflow cap`).

## Root Cause Analysis

Claude Code uses **React Ink** (or a similar TUI framework in Node.js) to manage and render its interactive CLI components. In a React-based TUI:
1. Every keystroke in the terminal input (REPL) updates the component state.
2. An update triggers a reconciliation walk down the Virtual DOM.
3. Ink translates the virtual tree into ANSI escape sequences and writes them to `stdout`.

When executing large workflows (such as nested subagents), the workflow tree accumulates a large number of `Agent` nodes (e.g. 700+ agents). Even if the terminal viewport limits the height of the displayed rows, Ink still holds and reconciles the entire array of agent components. Calculating layout (flexbox calculations) and diffs for hundreds of components on every single keystroke blocks the single-threaded Node.js event loop, resulting in noticeable typing lag.

---

## Technical Solution

### 1. Viewport Virtualization
Instead of rendering the full array of completed and active agents, the progress tree component must slice the agents list to only render what fits in the active terminal viewport.

### 2. State Memoization and Isolation
Isolate the REPL input's text state from the progress tree's render loop. By wrapping the progress tree in a memoized component (`React.memo`), keystrokes typed in the terminal input will not trigger reconciliation or layout passes on the progress tree.

---

## Proposed Code Fix (React/Ink)

Below is the proposed TypeScript implementation for virtualizing and memoizing the progress tree inside the CLI.

```typescript
import React, { useMemo, memo } from 'react';
import { Box, Text } from 'ink';

export interface Agent {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  message: string;
  timestamp: Date;
}

interface ProgressTreeProps {
  agents: Agent[];
  viewportHeight?: number;
  scrollOffset?: number;
}

/**
 * 1. Virtualized Progress Tree
 * Limits the number of active layout components passed to Ink's renderer.
 */
export const VirtualizedProgressTree: React.FC<ProgressTreeProps> = ({
  agents,
  viewportHeight = 15,
  scrollOffset = 0,
}) => {
  // Slice list to only include visible items, preventing Ink from layouting 700+ elements
  const visibleAgents = useMemo(() => {
    const start = Math.max(0, agents.length - viewportHeight - scrollOffset);
    const end = agents.length - scrollOffset;
    return agents.slice(start, end);
  }, [agents, viewportHeight, scrollOffset]);

  // Aggregate stats in a single pass to display in the header
  const stats = useMemo(() => {
    let completed = 0;
    let running = 0;
    let failed = 0;
    for (const agent of agents) {
      if (agent.status === 'completed') completed++;
      else if (agent.status === 'running') running++;
      else if (agent.status === 'failed') failed++;
    }
    return { completed, running, failed };
  }, [agents]);

  return (
    <Box flexDirection="column">
      {/* Summary Header */}
      <Box borderStyle="single" borderColor="dim" paddingX={1}>
        <Text>
          Workflow Progress: <Text color="green">{stats.completed} done</Text> |{' '}
          <Text color="yellow">{stats.running} running</Text> |{' '}
          <Text color="red">{stats.failed} failed</Text>
        </Text>
      </Box>

      {/* Rendered Agents (only visible slice) */}
      <Box flexDirection="column" marginTop={1}>
        {visibleAgents.map((agent) => (
          <Box key={agent.id} flexDirection="row" justifyContent="space-between">
            <Box flexDirection="row">
              <Text
                color={
                  agent.status === 'running'
                    ? 'yellow'
                    : agent.status === 'completed'
                    ? 'green'
                    : 'red'
                }
              >
                {agent.status === 'running' ? '●' : agent.status === 'completed' ? '✓' : '✗'}{' '}
                [{agent.name}]
              </Text>
              <Text dimColor marginLeft={1}>
                {agent.message}
              </Text>
            </Box>
            <Text dimColor>{agent.timestamp.toLocaleTimeString()}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/**
 * 2. Memoized Progress Container
 * Avoids reconciliation Walks when the user is typing in the REPL.
 */
export const MemoizedProgressTree = memo(
  VirtualizedProgressTree,
  (prevProps, nextProps) => {
    // Only re-render if count, scroll parameters, or individual agent statuses/messages change.
    if (prevProps.agents.length !== nextProps.agents.length) return false;
    if (prevProps.viewportHeight !== nextProps.viewportHeight) return false;
    if (prevProps.scrollOffset !== nextProps.scrollOffset) return false;

    for (let i = 0; i < prevProps.agents.length; i++) {
      if (
        prevProps.agents[i].status !== nextProps.agents[i].status ||
        prevProps.agents[i].message !== nextProps.agents[i].message
      ) {
        return false;
      }
    }
    return true;
  }
);
```
