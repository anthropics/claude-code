# Plan Auto-Show Plugin

Automatically displays the plan content when it's updated in plan mode, eliminating the need to type `/plan` to preview changes.

## Problem

When in plan mode, Claude updates the plan file and may ask follow-up questions. Users can't see the plan without typing `/plan`, but they also can't type `/plan` while being asked questions - they need to respond to the questions first.

## Solution

This plugin instructs Claude to automatically display the plan content in its response whenever it updates the plan file. The plan is shown before any follow-up questions, giving users the context they need to answer.

## Installation

1. Enable the plugin in your Claude Code settings
2. The SessionStart hook will automatically add instructions for plan auto-display

## How It Works

The plugin adds a SessionStart hook that provides additional context to Claude:
- After updating the plan file, Claude will display the full plan content
- The plan is shown in a markdown code block
- The plan appears before any follow-up questions

## Example

Before this plugin:
```
Claude: I've updated the plan file. Would you prefer approach A or B?
User: (Can't see the plan without typing /plan, but needs to answer the question)
```

After this plugin:
```
Claude: I've updated the plan file:

## Current Plan
1. Implement feature X
2. Add tests
3. Deploy

Would you prefer approach A or B?

User: (Can see the plan and answer the question)
```
