//! Performance benchmarks for Claude Code

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use tokio::runtime::Runtime;

fn bench_engine_startup(c: &mut Criterion) {
    c.bench_function("engine_startup", |b| {
        let rt = Runtime::new().unwrap();
        b.iter(|| {
            rt.block_on(async {
                let temp_dir = tempfile::TempDir::new().unwrap();
                let engine = claude_engine::Engine::new(temp_dir.path()).await;
                black_box(engine.is_initialized())
            })
        });
    });
}

fn bench_bash_execution(c: &mut Criterion) {
    let mut group = c.benchmark_group("bash_execution");
    
    for cmd in ["echo test", "ls -la", "cat /dev/null"].iter() {
        group.bench_with_input(BenchmarkId::new("command", cmd), cmd, |b, cmd| {
            let rt = Runtime::new().unwrap();
            let tool = claude_tools::BashTool::new();
            
            b.iter(|| {
                rt.block_on(async {
                    let input = claude_core::ToolInput::new(
                        serde_json::json!({"command": cmd})
                    );
                    let result = tool.execute(input, &claude_core::ToolContext::default()).await;
                    black_box(result)
                })
            });
        });
    }
    
    group.finish();
}

fn bench_file_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_operations");
    
    group.bench_function("write_small_file", |b| {
        let rt = Runtime::new().unwrap();
        let tool = claude_tools::FileWriteTool::new();
        let temp_dir = tempfile::TempDir::new().unwrap();
        
        b.iter(|| {
            rt.block_on(async {
                let path = temp_dir.path().join("test.txt");
                let input = claude_core::ToolInput::new(serde_json::json!({
                    "path": path.to_str().unwrap(),
                    "content": "Hello, World!"
                }));
                let result = tool.execute(input, &claude_core::ToolContext::default()).await;
                black_box(result)
            })
        });
    });
    
    group.finish();
}

criterion_group!(benches, bench_engine_startup, bench_bash_execution, bench_file_operations);
criterion_main!(benches);

