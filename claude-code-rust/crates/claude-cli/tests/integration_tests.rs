//! Integration tests for the Claude CLI application

use std::process::Command;

#[test]
fn test_cli_version() {
    let output = Command::new("cargo")
        .args(["run", "--quiet", "--", "--version"])
        .output()
        .expect("Failed to execute command");

    assert!(output.status.success(), "Command failed");

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("claude-cli") || stdout.contains("0.1.0"));
}

#[test]
fn test_cli_help() {
    let output = Command::new("cargo")
        .args(["run", "--quiet", "--", "--help"])
        .output()
        .expect("Failed to execute command");

    assert!(output.status.success(), "Command failed");

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Usage") || stdout.contains("OPTIONS") || stdout.contains("COMMANDS"));
}

#[test]
#[ignore] // Ignore by default as it requires API key
fn test_cli_doctor() {
    let output = Command::new("cargo")
        .args(["run", "--quiet", "--", "doctor"])
        .output()
        .expect("Failed to execute command");

    // Doctor command should run (may or may not succeed based on config)
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Just verify it runs without panicking
    assert!(!stdout.is_empty() || !stderr.is_empty());
}
