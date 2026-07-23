# Agent Markup Plugin

Make websites machine-readable for LLMs and AI agents using the current `agentmarkup` toolchain: `llms.txt`, optional `llms-full.txt`, JSON-LD, markdown mirrors, AI crawler directives, and agent-facing headers.

## What It Does

This plugin helps developers add machine-readable assets to their web projects so AI agents and LLMs can understand and interact with their sites.

It covers five areas:
- **`llms.txt`** — a standardized manifest that describes site content for LLMs
- **`llms-full.txt`** — optional inlined same-site context for deeper agent fetches
- **JSON-LD structured data** — schema.org markup that gives pages semantic meaning
- **Markdown mirrors** — optional `.md` pages for cleaner agent-facing fetch targets
- **AI crawler and header directives** — `robots.txt`, `_headers`, `Content-Signal`, and canonical `Link` headers where appropriate

## Command: `/agentmarkup`

Analyzes your project and guides you through setting up machine-readable assets with the right `agentmarkup` adapter or manual approach.

**Usage:**
```bash
/agentmarkup
```

Or with context:
```bash
/agentmarkup Set up llms.txt for my documentation site
```

The command will:
1. Detect your framework and who owns the final HTML output
2. Check for existing assets (`llms.txt`, `llms-full.txt`, JSON-LD, `robots.txt`, `_headers`, markdown mirrors)
3. Recommend the right setup approach
4. Guide implementation step by step
5. Validate the result and call out compatibility caveats

## Skill: `agentmarkup`

Automatically activates when you're working on site metadata, SEO, structured data, agent-readable assets, or AI crawler configuration. Provides contextual guidance on:

- llms.txt format and best practices
- llms-full.txt and markdown mirror tradeoffs
- JSON-LD schema.org types and validation
- AI crawler directives and headers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot`)
- `@agentmarkup/vite`, `@agentmarkup/astro`, and `@agentmarkup/core` compatibility
- Common mistakes to avoid

## When to Use

- Setting up a new website and want it to be AI-discoverable
- Adding structured data to an existing site
- Configuring robots.txt for AI crawlers
- Creating or editing an `llms.txt` or `llms-full.txt` manifest
- Generating markdown mirrors for agent-friendly fetches
- Making a documentation site agent-friendly
- Choosing between the Vite adapter, Astro adapter, and core helpers for a meta-framework or custom build

## Learn More

- [llms.txt specification](https://llmstxt.org)
- [schema.org](https://schema.org)
- [agentmarkup repository](https://github.com/agentmarkup/agentmarkup)
- [@agentmarkup/vite](https://github.com/agentmarkup/agentmarkup/tree/main/packages/vite)
- [@agentmarkup/astro](https://github.com/agentmarkup/agentmarkup/tree/main/packages/astro)
- [@agentmarkup/core](https://github.com/agentmarkup/agentmarkup/tree/main/packages/core)

## Compatibility Notes

- Use `@agentmarkup/vite` when plain Vite owns the final HTML output.
- Use `@agentmarkup/astro` for Astro sites.
- Use `@agentmarkup/core` in custom prerender or post-build pipelines, and for frameworks that do an additional final render step after Vite.
- Current schema presets are `webSite`, `organization`, `article`, `faqPage`, `product`, and `offer`.

## Author

Sebastian Cochinescu ([@cochinescu](https://github.com/cochinescu))
