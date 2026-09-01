# Building Claude Code CLI from Source

This document describes how to build the Claude Code CLI bundle (`cli.mjs`) from TypeScript source.

## Prerequisites

- [Bun](https://bun.sh) >= 1.1.0 (recommended) or Node.js >= 20
- esbuild (for bundling)

## Quick Start

```bash
# Install dependencies
bun install

# Build the CLI bundle
bun run build

# Output
# dist/cli.mjs      - The bundled CLI executable
# dist/cli.mjs.map  - Source map (for debugging)
```

## Build Scripts

| Command | Description |
|---------|-------------|
| `bun run build` | Development build with source maps |
| `bun run build:prod` | Production build (minified) |
| `bun run build:watch` | Watch mode for development |

## Build Configuration

The build process uses esbuild with the following key features:

### Entry Point
- **Input**: `src/entrypoints/cli.tsx`
- **Output**: `dist/cli.mjs`

### Key Build Features

1. **ESM Bundle**: Single-file ES module output with `.mjs` extension
2. **Platform**: Node.js 20+ target
3. **TypeScript**: Full TypeScript/TSX support with JSX transform
4. **Path Resolution**: Custom resolver for `src/` imports (tsconfig baseUrl)
5. **Stubbing**: Missing internal modules are stubbed for external builds
6. **External Dependencies**: Native addons and optional packages are externalized

### Build-time Defines

The following constants are injected at build time:

- `MACRO.VERSION` - Package version from package.json
- `MACRO.PACKAGE_URL` - NPM package identifier
- `process.env.USER_TYPE` - Set to `"external"` for external builds
- `process.env.NODE_ENV` - `"production"` or `"development"`

### Shebang

The output bundle includes a Node.js shebang for direct execution:
```javascript
#!/usr/bin/env node
```

## Output

After building, you'll have:

```
dist/
├── cli.mjs          # Main CLI bundle (executable)
├── cli.mjs.map      # Source map
├── package.json     # ESM marker
└── meta.json        # Bundle analysis metadata
```

Run the CLI:
```bash
./dist/cli.mjs --version
./dist/cli.mjs --help
```

## Customizing the Build

See `scripts/build-bundle.ts` for the full build configuration. Key options:

- `--watch` - Enable watch mode
- `--minify` - Enable minification for production
- `--no-sourcemap` - Disable source maps

## Architecture Notes

### Why esbuild?

- **Speed**: esbuild is written in Go and bundles ~500K lines of TypeScript in <500ms
- **Tree Shaking**: Dead code elimination reduces bundle size
- **Native Addons**: Proper handling of Node.js native modules

### Externalized Packages

The following are kept external (not bundled):

- Node.js built-in modules (`fs`, `path`, etc.)
- Native addons (`node-pty`, `better-sqlite3`, etc.)
- Anthropic-internal packages (`@ant/*`, `@anthropic-ai/*`)
- Optional cloud SDKs (AWS, Azure, GCP)
- Large optional dependencies

This keeps the bundle size reasonable (~20MB vs 100MB+ if everything was bundled).
