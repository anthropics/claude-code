# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Lightweight Governance - Soft LCT
# https://github.com/dp-web4/web4
"""
Software-only Linked Context Token (Soft LCT).

This is a lightweight implementation of LCT for environments without
TPM or hardware security modules. It provides:
- Machine + user derived identity
- Stable identity across sessions on same machine
- Clear indication of binding type (software vs hardware)

Trust interpretation is up to the relying party. A soft LCT indicates
the session was initiated from a particular machine/user combination,
but without hardware attestation.

For hardware-bound LCTs with TPM attestation, see Hardbound.
"""

import os
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict

from .ledger import Ledger


class SoftLCT:
    """Software-bound Linked Context Token."""

    def __init__(self, ledger: Optional[Ledger] = None):
        """
        Initialize soft LCT manager.

        Args:
            ledger: Ledger instance for persistence. Creates one if not provided.
        """
        self.ledger = ledger or Ledger()
        self._lct_cache: Optional[Dict] = None

    def _get_machine_hash(self) -> str:
        """Get stable machine identifier hash."""
        # Use nodename as primary identifier
        # In full implementation, could include more hardware identifiers
        try:
            nodename = os.uname().nodename
        except AttributeError:
            # Windows fallback
            import socket
            nodename = socket.gethostname()

        return hashlib.sha256(nodename.encode()).hexdigest()[:16]

    def _get_user_hash(self) -> str:
        """Get stable user identifier hash."""
        try:
            uid = str(os.getuid())
        except AttributeError:
            # Windows fallback
            uid = os.environ.get("USERNAME", "unknown")

        return hashlib.sha256(uid.encode()).hexdigest()[:16]

    def _generate_lct_id(self) -> str:
        """Generate a new soft LCT ID."""
        machine = self._get_machine_hash()
        user = self._get_user_hash()
        timestamp = datetime.now(timezone.utc).isoformat()

        # Create unique token combining machine, user, and time
        seed = f"{machine}:{user}:{timestamp}"
        token_hash = hashlib.sha256(seed.encode()).hexdigest()[:12]

        # LCT format: web4:soft:<machine_prefix>:<user_prefix>:<unique>
        return f"web4:soft:{machine[:8]}:{user[:8]}:{token_hash}"

    def get_or_create(self) -> Dict:
        """
        Get existing LCT for this machine/user or create new one.

        Returns the same LCT for the same machine/user combination,
        providing stable identity across sessions.
        """
        if self._lct_cache:
            return self._lct_cache

        machine_hash = self._get_machine_hash()
        user_hash = self._get_user_hash()

        # Check for existing identity
        existing = self._find_existing_identity(machine_hash, user_hash)
        if existing:
            self._lct_cache = existing
            return existing

        # Create new identity
        lct_id = self._generate_lct_id()
        now = datetime.now(timezone.utc).isoformat() + "Z"

        identity = {
            "lct_id": lct_id,
            "machine_hash": machine_hash,
            "user_hash": user_hash,
            "binding": "software",
            "created_at": now,
            "trust_note": "Software-bound identity without hardware attestation"
        }

        # Register in ledger
        self.ledger.register_identity(
            lct_id=lct_id,
            machine_hash=machine_hash,
            user_hash=user_hash,
            binding="software",
            metadata={"trust_note": identity["trust_note"]}
        )

        self._lct_cache = identity
        return identity

    def _find_existing_identity(self, machine_hash: str, user_hash: str) -> Optional[Dict]:
        """Find existing identity for machine/user combination."""
        # Query ledger for matching identity
        # In SQLite, we need to search - this is a simplified implementation
        import sqlite3

        with sqlite3.connect(self.ledger.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("""
                SELECT * FROM identities
                WHERE machine_hash = ? AND user_hash = ? AND binding = 'software'
                ORDER BY created_at DESC LIMIT 1
            """, (machine_hash, user_hash)).fetchone()

            if row:
                identity = dict(row)
                identity["trust_note"] = "Software-bound identity without hardware attestation"
                return identity

        return None

    def get_current(self) -> Optional[Dict]:
        """Get current LCT without creating if none exists."""
        if self._lct_cache:
            return self._lct_cache

        machine_hash = self._get_machine_hash()
        user_hash = self._get_user_hash()

        return self._find_existing_identity(machine_hash, user_hash)

    def get_token_id(self) -> str:
        """Get the LCT ID string."""
        identity = self.get_or_create()
        return identity["lct_id"]

    def verify_local(self) -> Dict:
        """
        Verify this is the expected machine/user.

        Returns verification result with confidence indicators.
        """
        identity = self.get_current()
        if not identity:
            return {
                "verified": False,
                "reason": "no_identity",
                "confidence": 0.0
            }

        current_machine = self._get_machine_hash()
        current_user = self._get_user_hash()

        machine_match = identity["machine_hash"] == current_machine
        user_match = identity["user_hash"] == current_user

        if machine_match and user_match:
            return {
                "verified": True,
                "lct_id": identity["lct_id"],
                "binding": "software",
                "confidence": 0.7,  # Software binding = moderate confidence
                "note": "Verified against local machine/user. No hardware attestation."
            }
        else:
            return {
                "verified": False,
                "reason": "mismatch",
                "machine_match": machine_match,
                "user_match": user_match,
                "confidence": 0.0
            }

    def to_header(self) -> str:
        """
        Get LCT formatted for use in headers or logging.

        Format: web4:soft:XXXXXXXX (shortened for display)
        """
        lct_id = self.get_token_id()
        # Return shortened version for display
        parts = lct_id.split(":")
        if len(parts) >= 5:
            return f"{parts[0]}:{parts[1]}:{parts[4]}"
        return lct_id
