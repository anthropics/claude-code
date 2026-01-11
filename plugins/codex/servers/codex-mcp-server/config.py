"""Configuration constants for OpenAI Codex OAuth integration.

Based on OpenCode's implementation:
- OAuth endpoint: https://auth.openai.com
- Client ID: app_EMoamEEZ73f0CkXaXp7hrann
- Codex API: https://chatgpt.com/backend-api/codex/responses
"""

import os

# OAuth Configuration (from OpenCode implementation)
OAUTH_ENDPOINT = "https://auth.openai.com"
CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
CALLBACK_PORT = 1455
CALLBACK_PATH = "/auth/callback"
REDIRECT_URI = f"http://localhost:{CALLBACK_PORT}{CALLBACK_PATH}"
OAUTH_SCOPES = "openid profile email offline_access"

# PKCE Configuration
PKCE_VERIFIER_LENGTH = 43
PKCE_METHOD = "S256"

# API Configuration
CODEX_API_URL = "https://chatgpt.com/backend-api/codex/responses"

# Token Storage
AUTH_FILE_PATH = os.path.expanduser("~/.claude/auth.json")
TOKEN_KEY = "openai_codex"

# User Config Storage
USER_CONFIG_PATH = os.path.expanduser("~/.claude/codex_config.json")
DEFAULT_MODEL = "gpt-5.2-codex"
DEFAULT_APPROVAL_MODE = "suggest"

# Available models
AVAILABLE_MODELS = [
    "gpt-5.2-codex",
    "gpt-5.2",
    "gpt-5.1-codex-max",
    "gpt-5.1-codex-mini"
]

# Approval modes
APPROVAL_MODES = [
    "suggest",      # Codex suggests, user confirms (default)
    "auto-edit",    # Codex can edit files automatically
    "full-auto"     # Codex has full control
]

# Timeouts & Retries
REQUEST_TIMEOUT = 30
OAUTH_TIMEOUT = 300  # 5 minutes for OAuth flow
MAX_RETRIES = 3
TOKEN_REFRESH_BUFFER = 300  # Refresh 5 min before expiry

# Debug
DEBUG = os.environ.get("CODEX_DEBUG", "0") == "1"
