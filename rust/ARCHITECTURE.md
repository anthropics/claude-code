# Claude Code Rust Implementation

## Quick Start

```bash
# Build the project
cargo build --release

# Run tests
cargo test

# Run the CLI
./target/release/claude --help
```

## Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

## Documentation

- [README.md](README.md) - User documentation
- [CONTRIBUTING.md](CONTRIBUTING.md) - Developer guide
- [CHANGELOG.md](CHANGELOG.md) - Version history
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design

## Crates

| Crate | Description |
|-------|-------------|
| claude-core | Core types and traits |
| claude-api | Anthropic API client |
| claude-engine | Query engine |
| claude-tui | Terminal UI |
| claude-tools | Tool implementations |
| claude-fs | File system utilities |
| claude-git | Git operations |
| claude-mcp | MCP client |
| claude-lsp | LSP client |
| claude-github | GitHub API |
| claude-aliases | Tool aliases |
| claude-permissions | Permission system |
| claude-config | Configuration |
| claude-cli | CLI entry point |

## License

MIT License - see [LICENSE](../LICENSE) for details.

