# Next.js + beautiful-mermaid Web Rendering Template

## Overview

For browser-based viewing, this skill produces a Next.js application that renders mermaid diagrams using beautiful-mermaid's SVG output with CSS/SMIL animation.

Architecture references:
- [Next.js](https://github.com/vercel/next.js) — React framework for production
- [beautiful-mermaid](https://github.com/vercel-labs/beautiful-mermaid) — SVG/ASCII mermaid renderer
- [coding-agent-template](https://github.com/vercel-labs/coding-agent-template) — Agent-driven development template
- [agent-browser](https://agent-browser.dev/) — Browser automation for testing

## Project Structure

```
deterministic-visual-web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # Main diagram viewer
│   ├── globals.css               # Theme variables
│   └── api/
│       └── render/
│           └── route.ts          # Server-side mermaid rendering
├── components/
│   ├── MermaidViewer.tsx          # beautiful-mermaid SVG component
│   ├── AsciiViewer.tsx           # ASCII art display with animation
│   ├── ThemeSwitcher.tsx         # Theme selection UI
│   └── FramePlayer.tsx           # Ghostty-style frame playback in browser
├── lib/
│   ├── mermaid-renderer.ts       # beautiful-mermaid wrapper
│   ├── theme-config.ts           # Theme definitions
│   └── frame-generator.ts        # Browser-side frame generation
├── public/
│   └── diagram.mmd              # Input diagram (copied by render.sh)
├── package.json
├── next.config.js
└── tsconfig.json
```

## package.json

```json
{
  "name": "deterministic-visual-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@vercel/beautiful-mermaid": "latest"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "typescript": "^5.7.0"
  }
}
```

## Key Components

### app/page.tsx — Main Viewer

```tsx
import { MermaidViewer } from '@/components/MermaidViewer';
import { AsciiViewer } from '@/components/AsciiViewer';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { readFile } from 'fs/promises';
import path from 'path';

export default async function Page() {
  const diagramPath = path.join(process.cwd(), 'public', 'diagram.mmd');
  const mermaidSource = await readFile(diagramPath, 'utf-8');

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <header className="border-b border-[var(--border)] p-6">
        <h1 className="text-2xl font-bold">Deterministic Visual</h1>
        <p className="text-[var(--muted)]">
          beautiful-mermaid + Ghostty-style animation
        </p>
        <ThemeSwitcher />
      </header>

      <section className="p-6">
        <h2 className="text-lg font-semibold mb-4">SVG Rendering</h2>
        <MermaidViewer source={mermaidSource} animated />
      </section>

      <section className="p-6 border-t border-[var(--border)]">
        <h2 className="text-lg font-semibold mb-4">ASCII Rendering</h2>
        <AsciiViewer source={mermaidSource} />
      </section>
    </main>
  );
}
```

### components/MermaidViewer.tsx

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  source: string;
  animated?: boolean;
  theme?: string;
}

export function MermaidViewer({ source, animated = true, theme = 'vercel-dark' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    async function render() {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, theme, animated }),
      });
      const data = await res.json();
      setSvg(data.svg);
    }
    render();
  }, [source, theme, animated]);

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 overflow-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
```

### components/FramePlayer.tsx — Browser Ghostty Animation

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  frames: string[];
  fps?: number;
  autoPlay?: boolean;
}

export function FramePlayer({ frames, fps = 30, autoPlay = true }: Props) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!playing || frames.length === 0) return;

    const interval = setInterval(() => {
      setCurrentFrame(prev => {
        if (prev >= frames.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [playing, fps, frames.length]);

  return (
    <div className="relative">
      <pre
        ref={preRef}
        className="font-mono text-sm leading-tight bg-[var(--bg)] text-[var(--fg)] p-4 rounded-lg border border-[var(--border)] overflow-auto"
        style={{ whiteSpace: 'pre', fontFamily: 'var(--font-mono, monospace)' }}
      >
        {frames[currentFrame] || ''}
      </pre>
      <div className="absolute top-2 right-2 flex gap-2">
        <button
          onClick={() => { setCurrentFrame(0); setPlaying(true); }}
          className="px-2 py-1 text-xs bg-[var(--accent)] text-white rounded"
        >
          Replay
        </button>
        <button
          onClick={() => setPlaying(!playing)}
          className="px-2 py-1 text-xs bg-[var(--surface)] border border-[var(--border)] rounded"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <span className="px-2 py-1 text-xs text-[var(--muted)]">
          {currentFrame + 1}/{frames.length}
        </span>
      </div>
    </div>
  );
}
```

### app/api/render/route.ts

```typescript
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { source, theme, animated } = await req.json();

  try {
    // When @vercel/beautiful-mermaid is installed:
    // import { renderMermaid, renderMermaidAscii } from '@vercel/beautiful-mermaid';
    // const svg = await renderMermaid(source, { theme, animated });
    // const ascii = await renderMermaidAscii(source, { theme });
    // return NextResponse.json({ svg, ascii });

    // Fallback: Return source as-is for client-side rendering
    return NextResponse.json({
      svg: `<pre style="font-family: monospace; padding: 1em;">${escapeHtml(source)}</pre>`,
      source,
      theme,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to render mermaid diagram' },
      { status: 500 }
    );
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

## CSS Theme Variables (globals.css)

```css
:root {
  /* Default: vercel-dark */
  --bg: #000000;
  --fg: #ededed;
  --accent: #0070f3;
  --line: #444444;
  --muted: #888888;
  --surface: #111111;
  --border: #333333;
}

[data-theme="dracula"] {
  --bg: #282a36;
  --fg: #f8f8f2;
  --accent: #bd93f9;
  --line: #44475a;
  --muted: #6272a4;
  --surface: #303241;
  --border: #44475a;
}

[data-theme="nord"] {
  --bg: #2e3440;
  --fg: #d8dee9;
  --accent: #88c0d0;
  --line: #3b4252;
  --muted: #4c566a;
  --surface: #3b4252;
  --border: #434c5e;
}

/* ... additional themes follow same pattern */
```

## Integration with agent-browser

For automated testing of the web output:

```bash
# Install agent-browser
npm install -g agent-browser

# Navigate to the rendered page
ab goto http://localhost:3000

# Verify SVG diagram rendered
ab text  # Get page text content

# Take screenshot for visual verification
ab screenshot --path output.png

# Check theme switching
ab click @theme-switcher
ab click @theme-dracula
ab screenshot --path output-dracula.png
```

## Integration with coding-agent-template

When deploying via Vercel's coding-agent-template:

1. The template creates an isolated sandbox
2. The Next.js app is deployed with the mermaid diagram
3. beautiful-mermaid renders SVG server-side
4. The FramePlayer component provides Ghostty-style animation in the browser
5. agent-browser can be used to validate the output

This enables a fully automated pipeline: process spec → mermaid → web visualization → automated testing.

## Deployment

```bash
# Local development
npm run dev

# Production build
npm run build && npm start

# Vercel deployment
vercel deploy
```
