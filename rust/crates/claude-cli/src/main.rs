//! CLI entry point

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    claude_cli::run().await
}

