# Collab

A Claude Code plugin that transforms Claude into a Socratic mentor for guided collaborative learning.

## Overview

Instead of writing code for you, Claude guides you through implementation step-by-step using the Socratic method. This plugin is designed for developers who want to **learn by doing** rather than copying and pasting solutions.

When you use `/collab`, Claude will:

- **Ask questions** to help you discover solutions yourself
- **Review your code** and explain why things work (or don't)
- **Build understanding** through guided discovery

## Philosophy

The Collab plugin is built on a simple principle: **the developer writes all code**.

Traditional AI coding assistants generate solutions for you. This is fast, but you miss the learning opportunity. Collab takes the opposite approach—Claude becomes a mentor who guides you through the implementation process, asking questions that help you discover the solution yourself.

This approach:

- **Builds deeper understanding** of the code you write
- **Develops problem-solving skills** that transfer to future challenges
- **Eliminates "black box" code** you don't fully understand
- **Adapts to your pace** based on your responses

## Usage

```
/collab <task description>
```

### Examples

```
/collab Add pagination to my API endpoint
/collab Implement user authentication with JWT
/collab Set up a WebSocket connection for real-time updates
/collab Refactor this component to use React hooks
/collab Add form validation to my signup page
```

## How It Works

The plugin follows a structured 3-phase workflow:

### Phase 1: Assess & Plan

Claude starts by understanding your task and context:

1. Asks clarifying questions about the goal
2. Gauges your familiarity with relevant technologies
3. Proposes a step-by-step plan
4. Gets your agreement before proceeding

### Phase 2: Step-by-Step Guidance

For each step in the plan, Claude:

1. Describes what needs to happen (conceptually, not code)
2. Asks guiding questions to help you discover the implementation
3. Waits for you to write and share your code
4. Reviews your implementation and explains the "why"
5. Confirms understanding before moving on

### Phase 3: Wrap-Up

After completing the implementation, Claude:

1. Summarizes what was built and key concepts learned
2. Highlights patterns or techniques you can reuse
3. Suggests optional improvements or further exploration

## When to Use Collab

**Use Collab when you want to:**

- Learn a new technology or framework
- Understand unfamiliar patterns in an existing codebase
- Reinforce fundamentals you've been meaning to practice
- Build something you'll need to maintain and understand deeply
- Develop your problem-solving skills

**Don't use Collab when you:**

- Need to ship something quickly and already understand the approach
- Are doing routine tasks you've done many times
- Want Claude to generate boilerplate code
- Need a quick prototype without learning goals

## Example Interaction

**User**: `/collab` Add pagination to my API endpoint

**Claude**: Great! Let's work through adding pagination together.

First, a few questions to understand the context:
1. What framework/language is your API built with?
2. Is this for a list endpoint that currently returns all results?
3. Do you have a preference for offset-based or cursor-based pagination?

**User**: Express.js, yes it returns all users, offset is fine

**Claude**: Perfect. Here's our plan:

1. Add query parameters for `page` and `limit`
2. Calculate the offset from these parameters
3. Modify the database query to use LIMIT and OFFSET
4. Return pagination metadata in the response

Sound good? Once you confirm, we'll start with step 1.

**User**: Yes, let's go

**Claude**: **Step 1: Query Parameters**

Your endpoint needs to accept `page` and `limit` from the request.

Think about:
- Where do query parameters come from in an Express request?
- What should the default values be if they're not provided?

Go ahead and write the code to extract these parameters with sensible defaults. Share it when you're ready.

## Comparison with Default Behavior

| Aspect | Default Claude Code | Collab Mode |
|--------|--------------------| ------------|
| Who writes code | Claude | You |
| Learning depth | Lower | Higher |
| Speed | Faster | Slower |
| Understanding | May be partial | Complete |
| Best for | Productivity | Learning |

## Installation

This plugin is installed as part of the Claude Code plugins collection. Once installed, the `/collab` command becomes available in your Claude Code sessions.

## License

MIT
