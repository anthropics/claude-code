"""
Encryption utilities for sensitive data (API keys, tokens)
"""
import base64
import hashlib
from django.conf import settings
from cryptography.fernet import Fernet, InvalidToken


def _get_fernet() -> Fernet:
    """Get Fernet cipher instance from settings key."""
    key = settings.FIELD_ENCRYPTION_KEY
    if not key:
        raise RuntimeError(
            "FIELD_ENCRYPTION_KEY not set. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode("utf-8"))


def encrypt_str(value: str) -> str:
    """Encrypt a string value."""
    if not value:
        return ""
    f = _get_fernet()
    return f.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_str(value: str) -> str:
    """Decrypt an encrypted string value."""
    if not value:
        return ""
    f = _get_fernet()
    try:
        return f.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        raise RuntimeError(
            "Failed to decrypt value: invalid token or key rotation mismatch"
        )


def hash_ip(ip: str) -> str:
    """
    Hash an IP address with salt for privacy-safe storage.
    Used for analytics without storing actual IPs.
    """
    salt = settings.SECRET_KEY[:16]
    return hashlib.sha256(f"{salt}{ip}".encode()).hexdigest()


def generate_encryption_key() -> str:
    """Generate a new Fernet encryption key."""
    return Fernet.generate_key().decode("utf-8")
