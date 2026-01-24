# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Lightweight Governance - Session Manager
# https://github.com/dp-web4/web4
"""
Session Manager for lightweight governance.

This is the main API for hooks to interact with governance:
- Start/end sessions with automatic numbering
- Track actions with ATP accounting
- Register work products
- Maintain audit trail

The session manager coordinates between:
- Soft LCT (identity)
- Ledger (persistence)
- Filesystem (session number sync)
"""

import os
import re
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, List

from .ledger import Ledger
from .soft_lct import SoftLCT


class SessionManager:
    """
    High-level session management API.

    Provides the main interface for hooks to use governance features.
    """

    def __init__(self, ledger: Optional[Ledger] = None, lct: Optional[SoftLCT] = None):
        """
        Initialize session manager.

        Args:
            ledger: Ledger instance. Creates one if not provided.
            lct: SoftLCT instance. Creates one if not provided.
        """
        self.ledger = ledger or Ledger()
        self.lct = lct or SoftLCT(self.ledger)
        self._current_session: Optional[Dict] = None

    def start_session(self, project: Optional[str] = None, atp_budget: int = 100,
                      sync_with_filesystem: bool = True, fs_pattern: Optional[str] = None,
                      fs_path: Optional[Path] = None) -> Dict:
        """
        Start a new session with automatic numbering.

        Args:
            project: Project name for session grouping
            atp_budget: Action budget for this session
            sync_with_filesystem: Whether to sync session number with filesystem
            fs_pattern: Regex pattern for session files (default: Session(\\d+)_.*.md)
            fs_path: Path to scan for existing sessions

        Returns:
            Session information dict
        """
        # Get or create identity
        identity = self.lct.get_or_create()

        # Sync with filesystem if requested
        if sync_with_filesystem and project:
            fs_max = self._scan_existing_sessions(project, fs_pattern, fs_path)
            if fs_max > 0:
                self.ledger.sync_session_number(project, fs_max)

        # Get next session number from ledger
        session_number = self.ledger.get_next_session_number(project) if project else None

        # Generate session ID
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        session_id = f"{project or 'default'}-{session_number or 'x'}-{timestamp}"

        # Start session in ledger
        session = self.ledger.start_session(
            session_id=session_id,
            lct_id=identity["lct_id"],
            project=project,
            session_number=session_number,
            atp_budget=atp_budget
        )

        self._current_session = session
        return session

    def _scan_existing_sessions(self, project: str, pattern: Optional[str] = None,
                                 path: Optional[Path] = None) -> int:
        """
        Scan filesystem for existing session files to determine max session number.

        This ensures ledger stays in sync with filesystem reality.
        """
        # Default pattern: Session###_*.md
        if pattern is None:
            pattern = r"Session(\d+)_.*\.md"

        # Default paths based on project
        if path is None:
            # Try common locations
            candidates = [
                Path.cwd() / "Research",
                Path.cwd(),
                Path.home() / "ai-workspace" / project / "Research",
            ]
            for candidate in candidates:
                if candidate.exists():
                    path = candidate
                    break
            else:
                return 0

        if not path.exists():
            return 0

        max_num = 0
        regex = re.compile(pattern)

        for file in path.iterdir():
            if file.is_file():
                match = regex.match(file.name)
                if match:
                    try:
                        num = int(match.group(1))
                        max_num = max(max_num, num)
                    except (ValueError, IndexError):
                        pass

        return max_num

    def end_session(self, status: str = "completed") -> Optional[Dict]:
        """
        End the current session.

        Args:
            status: Session end status (completed, aborted, error)

        Returns:
            Session summary or None if no current session
        """
        if not self._current_session:
            return None

        session_id = self._current_session["session_id"]
        self.ledger.end_session(session_id, status)

        summary = self.ledger.get_session_summary(session_id)
        self._current_session = None

        return summary

    def record_action(self, tool_name: str, target: Optional[str] = None,
                      input_data: Optional[Dict] = None, output_data: Optional[str] = None,
                      status: str = "success", atp_cost: int = 1) -> Dict:
        """
        Record an action (tool use) in the current session.

        Args:
            tool_name: Name of the tool used
            target: Target of the action (file path, URL, etc.)
            input_data: Tool input (will be hashed)
            output_data: Tool output (will be hashed)
            status: Action status
            atp_cost: ATP to consume for this action

        Returns:
            Action record
        """
        if not self._current_session:
            raise RuntimeError("No active session. Call start_session first.")

        session_id = self._current_session["session_id"]

        # Hash inputs/outputs for audit (don't store raw data)
        input_hash = None
        if input_data:
            input_hash = hashlib.sha256(
                str(input_data).encode()
            ).hexdigest()[:16]

        output_hash = None
        if output_data:
            output_hash = hashlib.sha256(
                str(output_data).encode()
            ).hexdigest()[:16]

        # Record in audit trail
        audit_id = self.ledger.record_audit(
            session_id=session_id,
            action_type="tool_use",
            tool_name=tool_name,
            target=target,
            input_hash=input_hash,
            output_hash=output_hash,
            status=status
        )

        # Consume ATP
        atp_remaining = self.ledger.consume_atp(session_id, atp_cost)

        return {
            "audit_id": audit_id,
            "tool_name": tool_name,
            "target": target,
            "status": status,
            "atp_remaining": atp_remaining
        }

    def register_work_product(self, product_type: str, path: Optional[str] = None,
                               content: Optional[str] = None,
                               metadata: Optional[Dict] = None) -> str:
        """
        Register a work product created in this session.

        Args:
            product_type: Type of product (file, commit, session_doc, etc.)
            path: Path to the product
            content: Content to hash (optional)
            metadata: Additional metadata

        Returns:
            Product ID
        """
        if not self._current_session:
            raise RuntimeError("No active session. Call start_session first.")

        return self.ledger.register_work_product(
            session_id=self._current_session["session_id"],
            product_type=product_type,
            path=path,
            content=content,
            metadata=metadata
        )

    def get_current_session(self) -> Optional[Dict]:
        """Get current session info."""
        if not self._current_session:
            return None

        return self.ledger.get_session(self._current_session["session_id"])

    def get_atp_remaining(self) -> int:
        """Get remaining ATP for current session."""
        session = self.get_current_session()
        return session["atp_remaining"] if session else 0

    def get_session_summary(self) -> Optional[Dict]:
        """Get summary of current session."""
        if not self._current_session:
            return None

        return self.ledger.get_session_summary(self._current_session["session_id"])

    def get_session_number(self) -> Optional[int]:
        """Get current session number."""
        if not self._current_session:
            return None
        return self._current_session.get("session_number")

    # --- Convenience methods for common patterns ---

    def quick_start(self, project: str) -> int:
        """
        Quick start for autonomous sessions.

        Returns session number for use in filenames.
        """
        session = self.start_session(project=project, sync_with_filesystem=True)
        return session["session_number"]

    def quick_end(self) -> Dict:
        """
        Quick end with summary.

        Returns session summary.
        """
        summary = self.end_session(status="completed")
        return summary or {"error": "no_session"}
