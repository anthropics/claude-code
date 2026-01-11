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
# OAuth endpoint (ChatGPT subscription: Plus/Pro/Team/Enterprise)
CODEX_API_URL = "https://chatgpt.com/backend-api/codex/responses"
CODEX_MODELS_URL = "https://chatgpt.com/backend-api/codex/models"
# OpenAI API endpoint (API key: usage-based billing)
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

# Client version for models API
CLIENT_VERSION = "1.0.0"

# Authentication methods
AUTH_METHOD_OAUTH = "oauth"      # ChatGPT subscription (Plus/Pro/Team/Enterprise)
AUTH_METHOD_API_KEY = "api_key"  # OpenAI API key (usage-based billing)
AUTH_METHODS = [AUTH_METHOD_OAUTH, AUTH_METHOD_API_KEY]

# Token Storage
AUTH_FILE_PATH = os.path.expanduser("~/.claude/auth.json")
TOKEN_KEY = "openai_codex"

# User Config Storage (project-specific)
USER_CONFIG_PATH = os.path.join(os.getcwd(), ".claude", "codex_config.json")
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
