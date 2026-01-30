#!/usr/bin/env python3
"""
Main Stop hook handler for verify-claims plugin.

Intercepts completion attempts, parses claims from transcript,
verifies them, and blocks completion if verification fails.
"""

import json
import os
import sys
import time
from pathlib import Path
from typing import Any

# Add scripts directory to path for imports
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))

from claim_parser import parse_claims  # noqa: E402
from transcript_reader import get_recent_assistant_text  # noqa: E402
from utils.config import get_config_value, load_config  # noqa: E402
from utils.logger import get_logger  # noqa: E402
from utils.state import SessionState  # noqa: E402
from utils.state import VerificationResult as StateVerificationResult  # noqa: E402
from verifiers import verify_claim  # noqa: E402


def read_hook_input() -> dict[str, Any]:
    """Read the hook input from stdin."""
    try:
        input_data = sys.stdin.read()
        if not input_data:
            return {}
        return json.loads(input_data)
    except json.JSONDecodeError:
        return {}


def output_decision(decision: str, reason: str = "") -> None:
    """Output the hook decision as JSON to stdout."""
    result = {"decision": decision}
    if reason:
        result["reason"] = reason
    print(json.dumps(result))


def main() -> int:
    """Main entry point for the verify_claims hook."""
    # Read hook input
    hook_input = read_hook_input()

    # Extract required fields
    session_id = hook_input.get("session_id", "unknown")
    transcript_path = hook_input.get("transcript_path")
    cwd = hook_input.get("cwd", os.getcwd())

    # Get plugin root from environment
    plugin_root = os.environ.get("CLAUDE_PLUGIN_ROOT", str(script_dir.parent))

    # Load configuration
    config = load_config(cwd, plugin_root)
    debug = config.get("debug", False)
    logger = get_logger(debug)

    logger.info(f"Verify-claims hook started for session: {session_id}")

    # Initialize session state
    state = SessionState(session_id)

    # Cleanup old state files periodically
    cleanup_days = get_config_value(config, "behavior", "cleanup_days", default=30)
    SessionState.cleanup_old_states(cleanup_days)

    # Prevent infinite loops - check if we're already in a verification
    if state.stop_hook_active:
        logger.warning("Stop hook already active, allowing to prevent loop")
        return 0

    # Check max retries
    max_retries = get_config_value(config, "behavior", "max_retries", default=3)
    if state.verification_count >= max_retries:
        logger.warning(f"Max retries ({max_retries}) reached, allowing completion")
        return 0

    # Mark hook as active
    state.stop_hook_active = True

    try:
        # Increment verification count
        count = state.increment_verification_count()
        logger.info(f"Verification attempt {count}/{max_retries}")

        # Read transcript if available
        if not transcript_path or not os.path.exists(transcript_path):
            logger.warning("No transcript path provided or file doesn't exist")
            return 0

        # Get recent assistant text
        assistant_text = get_recent_assistant_text(transcript_path, message_count=3)
        if not assistant_text:
            logger.info("No assistant text found in transcript")
            return 0

        # Parse claims from the text
        confidence_threshold = get_config_value(
            config, "behavior", "confidence_threshold", default=0.7
        )
        claims = parse_claims(assistant_text, confidence_threshold)

        if not claims:
            logger.info("No verifiable claims found")
            return 0

        logger.info(f"Found {len(claims)} claims to verify")

        # Verify each claim
        failed_claims: list[dict[str, Any]] = []
        passed_claims: list[dict[str, Any]] = []

        for claim in claims:
            logger.debug(f"Verifying claim: {claim.claim_type} - {claim.claim_text}")

            result = verify_claim(
                claim.claim_type,
                claim.extracted_value,
                cwd,
                config
            )

            # Record result in state
            state.add_verification_result(StateVerificationResult(
                claim_type=claim.claim_type,
                claim_text=claim.claim_text,
                passed=result.passed,
                message=result.message,
                timestamp=time.time(),
                details=result.details
            ))

            if result.passed:
                logger.info(f"✓ Claim verified: {claim.claim_type}")
                passed_claims.append({
                    "type": claim.claim_type,
                    "text": claim.claim_text,
                    "message": result.message
                })
            else:
                # Check if verification was skipped (not a real failure)
                if result.details.get("skipped"):
                    logger.info(f"○ Claim skipped: {claim.claim_type} - {result.message}")
                    passed_claims.append({
                        "type": claim.claim_type,
                        "text": claim.claim_text,
                        "message": result.message,
                        "skipped": True
                    })
                else:
                    logger.warning(f"✗ Claim failed: {claim.claim_type} - {result.message}")
                    failed_claims.append({
                        "type": claim.claim_type,
                        "text": claim.claim_text,
                        "message": result.message,
                        "details": result.details
                    })

        # Determine if we should block
        block_on_failure = get_config_value(
            config, "behavior", "block_on_failure", default=True
        )

        if failed_claims and block_on_failure:
            # Build failure message
            failure_summary = []
            for fc in failed_claims:
                failure_summary.append(f"- {fc['type']}: {fc['message']}")

            reason = "Claim verification failed:\n" + "\n".join(failure_summary)

            if passed_claims:
                passed_summary = [f"- {pc['type']}: {pc['message']}" for pc in passed_claims]
                reason += "\n\nPassed verifications:\n" + "\n".join(passed_summary)

            logger.warning(f"Blocking completion: {len(failed_claims)} failed claims")
            output_decision("block", reason)
            return 0

        # All claims passed or blocking disabled
        if passed_claims:
            logger.info(f"All {len(passed_claims)} claims verified successfully")

        return 0

    except Exception as e:
        logger.error(f"Verification error: {str(e)}")
        # Don't block on internal errors
        return 0

    finally:
        # Always clear the active flag
        state.stop_hook_active = False


if __name__ == "__main__":
    sys.exit(main())
