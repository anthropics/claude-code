# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Lightweight Governance - Ed25519 Cryptographic Signing
# https://github.com/dp-web4/web4
"""
Ed25519 Cryptographic Signing for Audit Records.

Each session generates a unique Ed25519 keypair. The private key is stored
in session state (hex-encoded), and the public key is used as the keyId.
Signatures provide non-repudiation: even if an attacker gains file access,
they cannot forge valid signatures without the private key.

Usage:
    from governance.signing import generate_signing_keypair, sign_data, verify_signature

    # Generate keypair for a session
    keypair = generate_signing_keypair()
    print(f"Key ID: {keypair['key_id']}")

    # Sign audit record
    data = json.dumps(record)
    signature = sign_data(data, keypair['private_key_hex'])

    # Verify signature
    is_valid = verify_signature(data, signature, keypair['public_key_hex'])
"""

from typing import TypedDict
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives import serialization


class SigningKeyPair(TypedDict):
    """Ed25519 keypair for signing audit records."""
    private_key_hex: str  # Hex-encoded private key (keep secret)
    public_key_hex: str   # Hex-encoded public key (safe to expose)
    key_id: str           # Short key ID (last 32 hex chars of public key)


def generate_signing_keypair() -> SigningKeyPair:
    """
    Generate a new Ed25519 keypair for signing audit records.

    Returns:
        SigningKeyPair with private_key_hex, public_key_hex, and key_id
    """
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()

    # Export as raw bytes then hex-encode
    private_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption()
    )
    public_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw
    )

    private_key_hex = private_bytes.hex()
    public_key_hex = public_bytes.hex()

    return SigningKeyPair(
        private_key_hex=private_key_hex,
        public_key_hex=public_key_hex,
        key_id=public_key_hex[-32:]  # Last 32 hex chars (16 bytes) as short ID
    )


def sign_data(data: str, private_key_hex: str) -> str:
    """
    Sign data with a private key.

    Args:
        data: The data to sign (will be UTF-8 encoded)
        private_key_hex: Hex-encoded private key from generate_signing_keypair

    Returns:
        Hex-encoded signature
    """
    private_bytes = bytes.fromhex(private_key_hex)
    private_key = Ed25519PrivateKey.from_private_bytes(private_bytes)

    signature = private_key.sign(data.encode('utf-8'))
    return signature.hex()


def verify_signature(data: str, signature_hex: str, public_key_hex: str) -> bool:
    """
    Verify a signature against data and public key.

    Args:
        data: The original data that was signed
        signature_hex: Hex-encoded signature
        public_key_hex: Hex-encoded public key

    Returns:
        True if signature is valid, False otherwise
    """
    try:
        public_bytes = bytes.fromhex(public_key_hex)
        public_key = Ed25519PublicKey.from_public_bytes(public_bytes)

        signature = bytes.fromhex(signature_hex)
        public_key.verify(signature, data.encode('utf-8'))
        return True
    except Exception:
        return False


def key_id_from_public_key(public_key_hex: str) -> str:
    """
    Extract the keyId from a public key hex string.

    Args:
        public_key_hex: Hex-encoded public key

    Returns:
        Short key ID (last 32 hex chars)
    """
    return public_key_hex[-32:]
