#!/usr/bin/env python3
"""Codex CLI - Command-line interface for OpenAI Codex integration.

Usage:
    python3 codex_cli.py <command> [options]

Commands:
    query           Send a query to Codex
    status          Check authentication status
    login           Start OAuth authentication flow
    set-api-key     Set API key for authentication
    logout          Clear all credentials
    models          List available models
    set-model       Set default model
    set-reasoning   Set default reasoning effort
    get-config      Get current configuration
    set-config      Set configuration value
    sessions        List recent sessions
    clear-sessions  Clear session history
    health          Check API health
"""

import sys
import os
import json
import argparse
import uuid
from typing import Optional

# Add CLI directory to path
_cli_dir = os.path.dirname(os.path.abspath(__file__))
if _cli_dir not in sys.path:
    sys.path.insert(0, _cli_dir)

from config import DEBUG
from auth.token_storage import TokenStorage
from auth.token_manager import TokenManager, TokenError
from auth.oauth_flow import OAuthFlow, OAuthError
from client.http_client import HttpClient
from client.codex_client import CodexClient, CodexError
from config.user_config import UserConfig, UserConfigError


def create_services():
    """Create and initialize all service instances."""
    storage = TokenStorage()
    http_client = HttpClient()
    oauth_flow = OAuthFlow(storage, http_client)
    token_manager = TokenManager(storage, oauth_flow)
    codex_client = CodexClient(token_manager, http_client)
    user_config = UserConfig()

    return {
        "storage": storage,
        "http_client": http_client,
        "oauth_flow": oauth_flow,
        "token_manager": token_manager,
        "codex_client": codex_client,
        "user_config": user_config
    }


def output_json(data: dict):
    """Output JSON response."""
    print(json.dumps(data, indent=2))


def output_error(error: str, code: int = 1):
    """Output error and exit."""
    output_json({"success": False, "error": error})
    sys.exit(code)


def cmd_query(args, services):
    """Send a query to Codex."""
    codex_client = services["codex_client"]
    user_config = services["user_config"]

    prompt = args.prompt
    if not prompt:
        output_error("Prompt is required")

    # Get model from args or config
    model = args.model or user_config.get_model()
    reasoning_effort = args.reasoning or user_config.get_reasoning_effort()

    # Handle session
    session_id = args.session
    messages = None

    if session_id:
        session = user_config.get_session(session_id)
        if session:
            messages = session.get("messages", [])

    try:
        response = codex_client.query(
            prompt=prompt,
            model=model,
            system_prompt=args.system,
            reasoning_effort=reasoning_effort,
            messages=messages
        )

        # Update or create session
        if session_id:
            # Existing session - update messages
            if messages is None:
                messages = []
            messages.append({"role": "user", "content": prompt})
            messages.append({"role": "assistant", "content": response})
            user_config.update_session(session_id, messages)
        elif args.save_session:
            # New session - create it
            new_session_id = str(uuid.uuid4())[:8]
            user_config.add_session(new_session_id, prompt)
            user_config.update_session(new_session_id, [
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": response}
            ])
            session_id = new_session_id

        output_json({
            "success": True,
            "response": response,
            "model": model,
            "reasoning_effort": reasoning_effort,
            "session_id": session_id
        })

    except CodexError as e:
        output_error(str(e))
    except Exception as e:
        output_error(f"Query failed: {e}")


def cmd_status(args, services):
    """Check authentication status."""
    token_manager = services["token_manager"]
    user_config = services["user_config"]

    auth_info = token_manager.get_token_info()
    config_info = user_config.get_config()

    output_json({
        "success": True,
        "auth": auth_info,
        "config": config_info
    })


def cmd_login(args, services):
    """Start OAuth authentication flow."""
    oauth_flow = services["oauth_flow"]

    try:
        print("Starting OAuth authentication flow...")
        print("Please complete the login in your browser.")

        tokens = oauth_flow.start_auth_flow(exchange_for_api_key=True)

        output_json({
            "success": True,
            "message": "Authentication successful",
            "has_api_key": "openai_api_key" in tokens
        })

    except OAuthError as e:
        output_error(f"OAuth failed: {e}")
    except Exception as e:
        output_error(f"Login failed: {e}")


def cmd_set_api_key(args, services):
    """Set API key for authentication."""
    token_manager = services["token_manager"]

    api_key = args.api_key
    if not api_key:
        output_error("API key is required")

    try:
        token_manager.set_api_key(api_key)
        masked = api_key[:7] + "..." + api_key[-4:] if len(api_key) > 15 else "sk-***"

        output_json({
            "success": True,
            "message": f"API key set: {masked}"
        })

    except TokenError as e:
        output_error(str(e))


def cmd_logout(args, services):
    """Clear all credentials."""
    token_manager = services["token_manager"]

    token_manager.clear_all()

    output_json({
        "success": True,
        "message": "All credentials cleared"
    })


def cmd_models(args, services):
    """List available models."""
    codex_client = services["codex_client"]
    user_config = services["user_config"]

    try:
        if args.fetch:
            # Fetch from API
            result = codex_client.fetch_models_from_api()
        else:
            # Static list
            models = codex_client.get_models()
            result = {
                "models": [{"id": m, "display_name": m} for m in models],
                "source": "static"
            }

        result["current_model"] = user_config.get_model()
        result["success"] = True
        output_json(result)

    except Exception as e:
        output_error(f"Failed to list models: {e}")


def cmd_set_model(args, services):
    """Set default model."""
    user_config = services["user_config"]

    model = args.model
    if not model:
        output_error("Model name is required")

    try:
        user_config.set_model(model)

        output_json({
            "success": True,
            "message": f"Default model set to: {model}"
        })

    except UserConfigError as e:
        output_error(str(e))


def cmd_set_reasoning(args, services):
    """Set default reasoning effort."""
    user_config = services["user_config"]

    effort = args.effort
    if not effort:
        output_error("Reasoning effort is required")

    try:
        user_config.set_reasoning_effort(effort)

        output_json({
            "success": True,
            "message": f"Default reasoning effort set to: {effort}"
        })

    except UserConfigError as e:
        output_error(str(e))


def cmd_get_config(args, services):
    """Get current configuration."""
    user_config = services["user_config"]

    config = user_config.get_config()
    config["success"] = True
    output_json(config)


def cmd_set_config(args, services):
    """Set configuration value."""
    user_config = services["user_config"]

    key = args.key
    value = args.value

    if not key or not value:
        output_error("Key and value are required")

    try:
        user_config.set_config(key, value)

        output_json({
            "success": True,
            "message": f"Config {key} set to: {value}"
        })

    except UserConfigError as e:
        output_error(str(e))


def cmd_sessions(args, services):
    """List recent sessions."""
    user_config = services["user_config"]

    limit = args.limit or 10
    sessions = user_config.get_sessions(limit)

    output_json({
        "success": True,
        "sessions": sessions,
        "count": len(sessions)
    })


def cmd_get_session(args, services):
    """Get a specific session."""
    user_config = services["user_config"]

    session_id = args.session_id
    if not session_id:
        output_error("Session ID is required")

    session = user_config.get_session(session_id)

    if session:
        output_json({
            "success": True,
            "session": session
        })
    else:
        output_error(f"Session not found: {session_id}")


def cmd_clear_sessions(args, services):
    """Clear session history."""
    user_config = services["user_config"]

    user_config.clear_sessions()

    output_json({
        "success": True,
        "message": "Session history cleared"
    })


def cmd_health(args, services):
    """Check API health."""
    codex_client = services["codex_client"]

    health = codex_client.health_check()
    health["success"] = True
    output_json(health)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Codex CLI - Command-line interface for OpenAI Codex integration"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # query command
    query_parser = subparsers.add_parser("query", help="Send a query to Codex")
    query_parser.add_argument("prompt", nargs="?", help="The prompt to send")
    query_parser.add_argument("--model", "-m", help="Model to use")
    query_parser.add_argument("--system", "-s", help="System prompt")
    query_parser.add_argument("--reasoning", "-r", help="Reasoning effort level")
    query_parser.add_argument("--session", help="Session ID to continue")
    query_parser.add_argument("--save-session", action="store_true", help="Save as new session")

    # status command
    subparsers.add_parser("status", help="Check authentication status")

    # login command
    subparsers.add_parser("login", help="Start OAuth authentication flow")

    # set-api-key command
    api_key_parser = subparsers.add_parser("set-api-key", help="Set API key for authentication")
    api_key_parser.add_argument("api_key", help="OpenAI API key (sk-...)")

    # logout command
    subparsers.add_parser("logout", help="Clear all credentials")

    # models command
    models_parser = subparsers.add_parser("models", help="List available models")
    models_parser.add_argument("--fetch", "-f", action="store_true", help="Fetch from API")

    # set-model command
    set_model_parser = subparsers.add_parser("set-model", help="Set default model")
    set_model_parser.add_argument("model", help="Model name")

    # set-reasoning command
    set_reasoning_parser = subparsers.add_parser("set-reasoning", help="Set default reasoning effort")
    set_reasoning_parser.add_argument("effort", help="Reasoning effort level")

    # get-config command
    subparsers.add_parser("get-config", help="Get current configuration")

    # set-config command
    set_config_parser = subparsers.add_parser("set-config", help="Set configuration value")
    set_config_parser.add_argument("key", help="Config key")
    set_config_parser.add_argument("value", help="Config value")

    # sessions command
    sessions_parser = subparsers.add_parser("sessions", help="List recent sessions")
    sessions_parser.add_argument("--limit", "-l", type=int, help="Number of sessions to show")

    # get-session command
    get_session_parser = subparsers.add_parser("get-session", help="Get a specific session")
    get_session_parser.add_argument("session_id", help="Session ID")

    # clear-sessions command
    subparsers.add_parser("clear-sessions", help="Clear session history")

    # health command
    subparsers.add_parser("health", help="Check API health")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Create services
    services = create_services()

    # Dispatch to command handler
    commands = {
        "query": cmd_query,
        "status": cmd_status,
        "login": cmd_login,
        "set-api-key": cmd_set_api_key,
        "logout": cmd_logout,
        "models": cmd_models,
        "set-model": cmd_set_model,
        "set-reasoning": cmd_set_reasoning,
        "get-config": cmd_get_config,
        "set-config": cmd_set_config,
        "sessions": cmd_sessions,
        "get-session": cmd_get_session,
        "clear-sessions": cmd_clear_sessions,
        "health": cmd_health
    }

    handler = commands.get(args.command)
    if handler:
        handler(args, services)
    else:
        output_error(f"Unknown command: {args.command}")


if __name__ == "__main__":
    main()
