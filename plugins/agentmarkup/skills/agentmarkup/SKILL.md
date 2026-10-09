---
name: agentmarkup
description: Guide developers on making websites machine-readable for LLMs and AI agents. Triggers when working on site metadata, `llms.txt`, `llms-full.txt`, JSON-LD, markdown mirrors, `robots.txt`, `_headers`, or `@agentmarkup` package configuration.
license: Complete terms in LICENSE.txt
---

This skill helps developers make their websites discoverable and readable by LLMs and AI agents using open standards.

## When to activate

Trigger this guidance when the developer is:
- Creating or editing `llms.txt` or `llms-full.txt`
- Creating or editing agent-facing markdown mirrors
- Working with JSON-LD structured data (`<script type="application/ld+json">`)
- Editing `robots.txt` with AI crawler directives
- Editing `_headers` for canonical `Link` or `Content-Signal`
- Adding SEO or metadata to a site
- Asking about making a site "AI-readable" or "agent-friendly"
- Setting up schema.org markup
- Installing or configuring `@agentmarkup/vite`, `@agentmarkup/astro`, or `@agentmarkup/core`

## Key standards

### llms.txt

A markdown file at `/llms.txt` that helps LLMs understand a website. Format:

```
# Site Name

> Brief description of the site

Optional longer description.

## Section

- [Page Title](https://example.com/page): Short description
```

- Place at site root (`/llms.txt`)
- Add discovery link in `<head>`: `<link rel="alternate" type="text/plain" href="/llms.txt">`
- Optional: `llms-full.txt` with inlined page content for deeper context
- If adapters generate markdown mirrors, same-site `llms.txt` entries may intentionally point to `.md` URLs instead of HTML routes

### JSON-LD structured data

Use schema.org types to describe page content:

- `WebSite` — for the site itself (name, URL, search action)
- `Organization` — for company/org identity (name, logo, contact)
- `Article` / `BlogPosting` — for content pages (headline, author, date)
- `Product` — for e-commerce (name, price, availability)
- `FAQPage` — for Q&A content (questions and answers)
- `Offer` — for pricing or commerce offer details

Place in `<head>` as `<script type="application/ld+json">`. One block per type. Validate required fields per schema.org spec.

When using the `agentmarkup` adapters, the current preset names are:

- `webSite`
- `organization`
- `article`
- `faqPage`
- `product`
- `offer`

Do not use the stale preset name `website`; the current preset is `webSite`.

### Markdown mirrors

Generated markdown mirrors can be useful when the final HTML is thin, noisy, or heavily client-rendered. They provide a cleaner fetch target for agents without replacing the primary HTML experience for browsers.

When mirrors are enabled:

- `llms.txt` may prefer the `.md` URLs for same-site entries by default
- The site may also emit canonical `Link` headers for the markdown routes so search engines keep the HTML route as canonical
- Existing markdown files should be preserved unless replacement is explicitly requested

### AI crawler directives in robots.txt

Common AI crawlers to consider:
- `GPTBot` (OpenAI)
- `ClaudeBot` (Anthropic)
- `PerplexityBot` (Perplexity)
- `Google-Extended` (Google AI training)
- `CCBot` (Common Crawl)

Example allowing all AI crawlers:
```
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /
```

If the site uses markdown mirrors, `_headers` may also matter:

- `Content-Signal` can describe AI training, search, and input permissions where supported
- canonical `Link` headers can point markdown routes back to their HTML counterparts

## Build-time tooling

For automated generation, the `agentmarkup` package provides build-time adapters:

- `@agentmarkup/vite` — Vite adapter when Vite owns the final HTML output
- `@agentmarkup/astro` — Astro integration for Astro builds
- `@agentmarkup/core` — Framework-agnostic generators, patchers, and validators for custom pipelines or meta-framework final render steps

Current adapter capabilities include:

- generating `llms.txt`
- generating optional `llms-full.txt`
- injecting the homepage `llms.txt` discovery link automatically
- injecting JSON-LD
- validating existing JSON-LD
- generating markdown mirrors
- patching `robots.txt`
- patching `_headers` for `Content-Signal` and markdown canonicals

These are optional. Manual setup still works well for many sites.

Use `@agentmarkup/core` instead of assuming the Vite adapter is safe in frameworks that perform another render or prerender pass after Vite.

## Common mistakes to avoid

- **Empty or placeholder llms.txt**: Every linked page should have a real description
- **Invalid JSON-LD**: Missing `@context: "https://schema.org"` or wrong `@type`
- **Using the wrong preset name**: The preset is `webSite`, not `website`
- **Using the Vite adapter in the wrong pipeline**: If another framework owns the final HTML, prefer `@agentmarkup/core` in that final step
- **Blocking AI crawlers unintentionally**: Check `robots.txt` for blanket `Disallow: /` rules
- **Duplicate JSON-LD blocks**: One block per schema type per page
- **Assuming replacement is the default**: Current adapters preserve existing curated `llms.txt`, matching crawler rules, and existing schema types unless replacement is explicitly enabled
- **Missing discovery link**: Without `<link rel="alternate">` in `<head>`, crawlers may not find `llms.txt` when the adapter is not injecting it automatically
- **Forgetting `_headers` when mirrors are important**: If markdown mirrors are part of the design and the host supports headers files, canonical `Link` headers and `Content-Signal` may be part of the intended setup
