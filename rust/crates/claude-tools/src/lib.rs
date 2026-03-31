//! Tool implementations

pub mod bash;
pub mod file;
pub mod grep;
pub mod list;

pub use bash::BashTool;
pub use file::FileTool;
pub use grep::GrepTool;
pub use list::LSTool;

use claude_core::{Tool, Tools};

/// Create default tool set
pub fn default_tools() -> Tools {
    let mut tools = Tools::new();
    tools.register(BashTool::new());
    tools.register(FileTool::new());
    tools.register(GrepTool::new());
    tools.register(LSTool::new());
    tools
}

