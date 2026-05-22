---
description: Analyze a web project and set up machine-readable assets for LLMs and AI agents
argument-hint: Optional framework or setup question
---

# Agent Markup Setup

You are helping a developer make their website machine-readable for LLMs and AI agents. Analyze the project and guide them through adding the right assets.

## Core Principles

- **Detect before suggesting**: Read the project's config files and dependencies before recommending anything
- **Minimal, correct setup**: Only suggest what the project actually needs
- **Compatibility-first**: Match the current `agentmarkup` package surface from `github.com/agentmarkup/agentmarkup`
- **Standards-first**: Prioritize the `llms.txt` specification and schema.org JSON-LD
- **Non-destructive**: Never overwrite existing metadata without asking
- **Do not install or build without approval**: Ask before running package-manager installs or build commands

---

## Phase 1: Project Detection

**Goal**: Understand the project's framework, who owns the final HTML output, and which machine-readable assets already exist

**Actions**:
1. Check for framework config files:
   - `vite.config.ts` / `vite.config.js` → Vite project
   - `astro.config.mjs` / `astro.config.ts` → Astro project
   - `next.config.ts` / `next.config.js` → Next.js project
   - `nuxt.config.ts` → Nuxt project
   - `svelte.config.js` / `svelte.config.ts` → SvelteKit project
   - `remix.config.js` / `remix.config.ts` → Remix project
   - Static HTML → Plain site
2. Check for existing metadata:
   - `public/llms.txt` or `llms.txt` → Already has llms.txt
   - `public/llms-full.txt` or `llms-full.txt` → Already has llms-full.txt
   - JSON-LD `<script type="application/ld+json">` in HTML → Already has structured data
   - `robots.txt` → Check for AI crawler directives
   - `_headers` → Check for `Content-Signal` or markdown canonical `Link` headers
   - Existing generated `.md` pages → Check whether the site already ships markdown mirrors
   - `<link rel="alternate" type="text/plain" href="/llms.txt">` in page head or layout → Check llms discovery
3. Check for existing packages:
   - `@agentmarkup/vite`, `@agentmarkup/astro`, `@agentmarkup/core` in `package.json`
4. Determine whether Vite or Astro owns the final HTML files, or whether another framework performs a final render after Vite
5. Summarize findings, compatibility constraints, and what's missing

---

## Phase 2: Recommend Setup

**Goal**: Suggest the right approach based on what was found

Based on the detected framework, recommend one of:

### For plain Vite projects
- Install `@agentmarkup/vite` for automated build-time generation
- Configure `agentmarkup()` in `vite.config.ts`
- Use this only when Vite owns the final HTML output

### For Astro projects
- Install `@agentmarkup/astro` for automated build-time generation
- Configure `agentmarkup()` in `astro.config.mjs` or `astro.config.ts`

### For meta-frameworks or custom render pipelines
- Use `@agentmarkup/core` in the final prerender or post-build step
- This is usually the right fit for Next.js, Nuxt, SvelteKit, Remix, or any pipeline where Vite does not own the deployed HTML
- Do not assume the Vite adapter will survive a later framework render pass

### For any project (manual approach)
Guide the developer to create:
1. `llms.txt` — a manifest of site content for LLMs (see spec below)
2. Optional `llms-full.txt` — richer inline context for agents that can consume more than the compact manifest
3. JSON-LD structured data in page `<head>`
4. Optional markdown mirrors if the raw HTML is a poor agent fetch target
5. AI crawler directives in `robots.txt`
6. Optional `_headers` entries when the host supports `Content-Signal` or markdown canonical `Link` headers

**Present the recommendation and ask the user which approach they prefer.**

---

## Phase 3: Implementation

**Goal**: Set up the chosen approach

**DO NOT START WITHOUT USER APPROVAL**

Before any install, build, or dependency change, ask for approval.

### If using agentmarkup packages:
1. Install the appropriate package
2. Add `agentmarkup()` to the framework config with the current option names:
   - Required basics: `site`, `name`, `description`
   - Content manifests: `llmsTxt`, optional `llmsFullTxt`
   - Optional cleaner fetch paths: `markdownPages`
   - Optional agent-facing headers: `contentSignalHeaders`
   - Schemas: `globalSchemas` and page-specific `pages[].schemas`
   - AI crawlers: `aiCrawlers`
3. Use the current schema presets:
   - `webSite` — general site identity
   - `organization` — company or organization identity
   - `article` — content pages
   - `faqPage` — FAQ pages
   - `product` — ecommerce entities
   - `offer` — commerce offers
4. Explain that existing curated `llms.txt`, matching crawler rules, and existing JSON-LD are preserved by default unless the user explicitly opts into replacement
5. Run a build to verify output only after approval
6. Check generated `llms.txt`, optional `llms-full.txt`, JSON-LD injection, markdown mirrors, `robots.txt`, and `_headers` patches

### If setting up manually:
1. Create `public/llms.txt` following the specification:
   ```
   # [Site Name]

   > [One-line site description]

   [Longer description of what the site offers and who it's for]

   ## Docs

   - [Page Title](https://example.com/page): Short description

   ## Optional: API Reference, Blog, etc.

   - [Title](https://example.com/path): Description
   ```
2. Optionally create `public/llms-full.txt` if the user wants richer inlined context
3. Add JSON-LD to the site's `<head>` using the appropriate schema.org type
4. Add `<link rel="alternate" type="text/plain" href="/llms.txt">` to `<head>` for discovery
5. Optionally create markdown mirrors when the HTML output is thin or noisy for agent fetches
6. Optionally add AI crawler directives to `robots.txt`
7. If markdown mirrors are added and the host supports it, add `_headers` entries for canonical `Link` headers and optionally `Content-Signal`

---

## Phase 4: Validation

**Goal**: Verify everything works

**Actions**:
1. Check `llms.txt` is accessible and well-formed
2. Check `llms-full.txt` if present
3. Verify JSON-LD validates with correct `@context`, `@type`, and required fields
4. Confirm the homepage exposes an `llms.txt` discovery link, unless the adapter handles this automatically
5. Confirm `robots.txt` has the desired AI crawler directives if used
6. Confirm `_headers` entries if markdown mirrors or `Content-Signal` are part of the setup
7. Summarize what was preserved vs generated and any remaining compatibility caveats

---

## llms.txt Specification Reference

The `llms.txt` file is a standardized way to provide information about a website to LLMs. It lives at the site root (`/llms.txt`) and uses markdown formatting:

- **Title**: `# Site Name` (H1 heading)
- **Summary**: `> Blockquote` with a brief description
- **Body**: Optional longer description paragraph
- **Sections**: `## Section Name` with lists of links
- **Links**: `- [Title](URL): Optional description`

Optional companion: `llms-full.txt` with inlined page content for deeper context.

## Compatibility Notes

- `@agentmarkup/vite` and `@agentmarkup/astro` can inject the homepage `llms.txt` discovery link automatically.
- `@agentmarkup/vite` is best when Vite owns the final HTML files.
- When another framework performs the final render, prefer `@agentmarkup/core` in that final step.

---
