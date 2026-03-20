# Example Skills Plugin

A collection of example skills demonstrating various Claude capabilities — from creative coding and visual design to communications, MCP development, and web testing.

## Skills

| Skill | Description |
|-------|-------------|
| [algorithmic-art](./skills/algorithmic-art/) | Create generative art with code using Canvas, p5.js, or Python |
| [brand-guidelines](./skills/brand-guidelines/) | Apply and maintain visual brand consistency |
| [canvas-design](./skills/canvas-design/) | Build 2D graphics and animations with the HTML Canvas API |
| [doc-coauthoring](./skills/doc-coauthoring/) | Co-author documents, reports, and long-form content |
| [frontend-design](./skills/frontend-design/) | Create distinctive, production-grade frontend interfaces |
| [internal-comms](./skills/internal-comms/) | Draft company announcements, memos, and team updates |
| [mcp-builder](./skills/mcp-builder/) | Build MCP (Model Context Protocol) servers and tool integrations |
| [skill-creator](./skills/skill-creator/) | Create new skills for Claude Code plugins |
| [slack-gif-creator](./skills/slack-gif-creator/) | Generate animated GIFs for Slack and other platforms |
| [theme-factory](./skills/theme-factory/) | Design cohesive color themes and CSS design token systems |
| [web-artifacts-builder](./skills/web-artifacts-builder/) | Build self-contained interactive web demos and prototypes |
| [webapp-testing](./skills/webapp-testing/) | Write unit, integration, and end-to-end tests for web apps |

## Usage

Each skill is auto-invoked when a user request matches the skill's trigger phrases. For example:

- "Create some generative art with Perlin noise" → triggers `algorithmic-art`
- "Apply our brand guidelines to this page" → triggers `brand-guidelines`
- "Build an MCP server for my API" → triggers `mcp-builder`
- "Write a company-wide announcement about our new policy" → triggers `internal-comms`

## Installation

Include this plugin in your Claude Code configuration to enable all example skills.
