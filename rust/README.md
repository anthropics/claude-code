# Claude Code Rust Implementation

A high-performance, production-ready Rust implementation of Claude Code, Anthropic's AI coding assistant.

## Performance Improvements

| Metric | TypeScript/Bun | Rust Target | Improvement |
|--------|---------------|-------------|-------------|
| Startup Time | ~135-200ms | <50ms | **4x faster** |
| Tool Execution | ~50-100ms | <20ms | **3-5x faster** |
| File Search (grep) | ~500ms/1M lines | <100ms | **5x faster** |
| Memory Usage | ~200-400MB | <100MB | **2-4x lower** |
| Binary Size | ~200MB (Bun + deps) | ~15MB | **13x smaller** |

## Architecture

Multi-crate workspace with 9 specialized crates:

- `claude-core`: Core abstractions and types
- `claude-engine`: Query engine and orchestration
- `claude-api`: Anthropic API client with streaming
- `claude-tools`: Tool implementations (bash, file, grep, ls)
- `claude-fs`: File system operations with caching
- `claude-permissions`: Permission management
- `claude-sandbox`: Process sandboxing
- `claude-cli`: Command-line interface
- `claude-ffi`: Foreign Function Interface for TypeScript interop

## Quick Start

```bash
# Build
cargo build --release

# Configure
export ANTHROPIC_API_KEY="your-api-key"

# Run
./target/release/claude-code chat "Hello!"
```

See [MIGRATION.md](MIGRATION.md) for detailed migration guide.

