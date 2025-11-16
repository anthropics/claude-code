//! Authentication module for Claude Code
//!
//! Implements OAuth-like authentication flow where:
//! 1. A local HTTP server starts on a random port
//! 2. Browser opens to Anthropic's authentication page
//! 3. User authenticates and is redirected back to localhost
//! 4. Token is received and stored in config

use anyhow::{Context, Result};
use axum::{
    extract::{Query, State},
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use colored::Colorize;
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::oneshot;

/// Authentication state shared between handlers
#[derive(Clone)]
struct AuthState {
    /// Channel to send the received token
    tx: Arc<tokio::sync::Mutex<Option<oneshot::Sender<String>>>>,
}

/// Query parameters from the OAuth callback
#[derive(Deserialize)]
struct AuthCallback {
    /// The API token from Anthropic
    token: Option<String>,
    /// Error message if authentication failed
    #[allow(dead_code)]
    error: Option<String>,
}

/// Success page HTML
const SUCCESS_HTML: &str = r#"
<!DOCTYPE html>
<html>
<head>
    <title>Claude Code - Authentication Successful</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 3rem;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
        }
        h1 {
            color: #333;
            margin-bottom: 1rem;
        }
        .success-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        p {
            color: #666;
            line-height: 1.6;
        }
        .note {
            margin-top: 2rem;
            padding: 1rem;
            background: #f0f0f0;
            border-radius: 5px;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✓</div>
        <h1>Authentication Successful!</h1>
        <p>You have successfully authenticated with Claude Code.</p>
        <p>You can close this window and return to your terminal.</p>
        <div class="note">
            Your API token has been securely stored in <code>~/.claude/settings.json</code>
        </div>
    </div>
</body>
</html>
"#;

/// Error page HTML
const ERROR_HTML: &str = r#"
<!DOCTYPE html>
<html>
<head>
    <title>Claude Code - Authentication Failed</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .container {
            background: white;
            padding: 3rem;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
        }
        h1 {
            color: #c0392b;
            margin-bottom: 1rem;
        }
        .error-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        p {
            color: #666;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">✗</div>
        <h1>Authentication Failed</h1>
        <p>There was an error during authentication.</p>
        <p>Please try again or use an API key manually.</p>
    </div>
</body>
</html>
"#;

/// Handle the OAuth callback
async fn handle_callback(
    Query(params): Query<AuthCallback>,
    State(state): State<AuthState>,
) -> impl IntoResponse {
    if let Some(token) = params.token {
        // Send token through channel
        if let Some(tx) = state.tx.lock().await.take() {
            let _ = tx.send(token);
        }
        Html(SUCCESS_HTML)
    } else {
        Html(ERROR_HTML)
    }
}

/// Run the authentication flow
///
/// This function:
/// 1. Starts a local HTTP server
/// 2. Opens the user's browser to the authentication page
/// 3. Waits for the callback with the token
/// 4. Saves the token to the user's config
///
/// Returns the API token on success
pub async fn authenticate() -> Result<String> {
    println!("{}", "🔐 Authentication Required".bold().cyan());
    println!();
    println!("To use Claude Code, you need to authenticate with your Anthropic account.");
    println!("A browser window will open for authentication...");
    println!();

    // Create channel for receiving the token
    let (tx, rx) = oneshot::channel();

    let state = AuthState {
        tx: Arc::new(tokio::sync::Mutex::new(Some(tx))),
    };

    // Create the router
    let app = Router::new()
        .route("/callback", get(handle_callback))
        .with_state(state);

    // Bind to a random available port
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .context("Failed to bind to local address")?;

    let addr = listener.local_addr()?;
    let port = addr.port();

    println!(
        "Started local server on {}",
        format!("http://127.0.0.1:{}", port).green()
    );

    // Build the authentication URL
    let auth_url = format!(
        "https://claude.ai/login?cli_auth=true&redirect_uri=http://127.0.0.1:{}/callback",
        port
    );

    println!();
    println!("Opening browser to: {}", auth_url.blue().underline());
    println!();
    println!(
        "{}",
        "If the browser doesn't open automatically, please visit the URL above.".yellow()
    );
    println!();

    // Open the browser
    if let Err(e) = open::that(&auth_url) {
        eprintln!("{}", format!("⚠ Failed to open browser: {}", e).yellow());
        println!("Please manually open this URL in your browser:");
        println!("{}", auth_url);
    }

    // Start the server in the background
    let server = axum::serve(listener, app);
    let server_handle = tokio::spawn(async move {
        let _ = server.await;
    });

    // Wait for the token with a timeout
    let token = tokio::time::timeout(
        std::time::Duration::from_secs(300), // 5 minute timeout
        rx,
    )
    .await
    .context("Authentication timed out after 5 minutes")?
    .context("Failed to receive authentication token")?;

    // Shutdown the server
    server_handle.abort();

    println!();
    println!("{}", "✓ Authentication successful!".green().bold());
    println!();

    // Save the token to config
    save_token_to_config(&token).await?;

    Ok(token)
}

/// Save the API token to the user's config file
async fn save_token_to_config(token: &str) -> Result<()> {
    use claude_config::{ensure_user_config_dir, user_settings_path, ClaudeConfig};

    // Ensure config directory exists
    ensure_user_config_dir()?;

    // Load existing config or create new one
    let mut config = ClaudeConfig::load().unwrap_or_default();

    // Set the API key
    config.api_key = Some(token.to_string());

    // Save to user settings
    let settings_path = user_settings_path()?;
    config
        .save(&settings_path)
        .context("Failed to save API token to config")?;

    println!(
        "API token saved to: {}",
        settings_path.display().to_string().green()
    );

    Ok(())
}

/// Check if the user has a valid API key configured
pub fn has_api_key() -> bool {
    // Check environment variables
    if std::env::var("ANTHROPIC_API_KEY").is_ok() || std::env::var("CLAUDE_API_KEY").is_ok() {
        return true;
    }

    // Check config file
    if let Ok(config) = claude_config::ClaudeConfig::load() {
        if config.api_key.is_some() {
            return true;
        }
    }

    false
}

/// Get or authenticate for an API key
///
/// This function will:
/// 1. Check for an existing API key in env vars or config
/// 2. If not found, start the authentication flow
/// 3. Return the API key
pub async fn get_or_authenticate() -> Result<String> {
    // Try environment variables first
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
        return Ok(key);
    }
    if let Ok(key) = std::env::var("CLAUDE_API_KEY") {
        return Ok(key);
    }

    // Try config file
    if let Ok(config) = claude_config::ClaudeConfig::load() {
        if let Some(key) = config.api_key {
            return Ok(key);
        }
    }

    // No API key found, start authentication flow
    println!();
    println!("{}", "No API key found.".yellow().bold());
    println!();

    authenticate().await
}
