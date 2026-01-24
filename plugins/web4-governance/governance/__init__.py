# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Lightweight Governance
# https://github.com/dp-web4/web4
"""
Lightweight governance for Claude Code plugin.

This is a software-only implementation of Web4 governance concepts:
- Soft LCT (software-bound identity, no TPM)
- Local SQLite ledger (session tracking, work products, ATP)
- R6 workflow (request → result with audit trail)

For hardware-bound identity and enterprise features, see Hardbound.

Note: This module can be used alongside the existing heartbeat tracking.
The hooks currently use heartbeat; this module provides additional
ledger-based coordination for session numbering and work tracking.
"""

from .ledger import Ledger
from .soft_lct import SoftLCT
from .session_manager import SessionManager

__all__ = ['Ledger', 'SoftLCT', 'SessionManager']
