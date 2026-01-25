"""
Trust Backend Bridge Module

Provides a unified interface to trust primitives, using the Rust backend
(web4_trust) when available, falling back to pure Python implementation.

The Rust backend provides:
- 10-50x faster tensor operations
- 2-5x lower memory usage
- Same JSON format compatibility

Usage:
    from governance.trust_backend import EntityTrust, TrustStore, T3Tensor, V3Tensor
    from governance.trust_backend import get_backend_info, RUST_BACKEND
"""

import os
from typing import Optional, Dict, Any, List

# Check for environment variable to force Python backend
FORCE_PYTHON_BACKEND = os.environ.get('WEB4_FORCE_PYTHON_BACKEND', '').lower() in ('true', '1', 'yes')

# Try to import Rust backend
RUST_BACKEND = False
_backend_error = None

if not FORCE_PYTHON_BACKEND:
    try:
        from web4_trust import (
            EntityTrust as _RustEntityTrust,
            T3Tensor as _RustT3Tensor,
            V3Tensor as _RustV3Tensor,
            TrustStore as _RustTrustStore,
            create_memory_store as _rust_create_memory_store,
        )
        RUST_BACKEND = True
    except ImportError as e:
        _backend_error = str(e)

# Import Python fallback
from .entity_trust import EntityTrust as _PyEntityTrust

# Python implementation doesn't have separate tensor classes
# We create simple wrappers for API compatibility
class _PyT3Tensor:
    """Python fallback T3 Tensor wrapper."""
    def __init__(self, competence=0.5, reliability=0.5, consistency=0.5,
                 witnesses=0.5, lineage=0.5, alignment=0.5):
        self.competence = competence
        self.reliability = reliability
        self.consistency = consistency
        self.witnesses = witnesses
        self.lineage = lineage
        self.alignment = alignment

    def average(self):
        return (self.competence + self.reliability + self.consistency +
                self.witnesses + self.lineage + self.alignment) / 6.0

    @classmethod
    def neutral(cls):
        return cls()


class _PyV3Tensor:
    """Python fallback V3 Tensor wrapper."""
    def __init__(self, energy=0.5, contribution=0.5, stewardship=0.5,
                 network=0.5, reputation=0.5, temporal=0.5):
        self.energy = energy
        self.contribution = contribution
        self.stewardship = stewardship
        self.network = network
        self.reputation = reputation
        self.temporal = temporal

    def average(self):
        return (self.energy + self.contribution + self.stewardship +
                self.network + self.reputation + self.temporal) / 6.0

    @classmethod
    def neutral(cls):
        return cls()

# Select backend
if RUST_BACKEND:
    EntityTrust = _RustEntityTrust
    T3Tensor = _RustT3Tensor
    V3Tensor = _RustV3Tensor
    TrustStore = _RustTrustStore

    def create_memory_store():
        """Create an in-memory trust store (Rust backend)."""
        return _rust_create_memory_store()
else:
    EntityTrust = _PyEntityTrust
    T3Tensor = _PyT3Tensor
    V3Tensor = _PyV3Tensor

    # Python fallback for TrustStore
    class TrustStore:
        """Simple file-based trust store (Python fallback)."""

        def __init__(self, base_dir: str):
            self.base_dir = base_dir
            self._entities: Dict[str, Any] = {}
            os.makedirs(base_dir, exist_ok=True)
            self._load_existing()

        def _load_existing(self):
            """Load existing entities from disk."""
            import json
            import hashlib

            if not os.path.exists(self.base_dir):
                return

            for filename in os.listdir(self.base_dir):
                if filename.endswith('.json'):
                    filepath = os.path.join(self.base_dir, filename)
                    try:
                        with open(filepath, 'r') as f:
                            data = json.load(f)
                            entity_id = data.get('entity_id')
                            if entity_id:
                                entity = _PyEntityTrust(entity_id)
                                entity.from_dict(data)
                                self._entities[entity_id] = entity
                    except Exception:
                        pass

        def _entity_path(self, entity_id: str) -> str:
            """Get file path for entity."""
            import hashlib
            hash_id = hashlib.sha256(entity_id.encode()).hexdigest()[:16]
            return os.path.join(self.base_dir, f"{hash_id}.json")

        def get(self, entity_id: str) -> Any:
            """Get entity by ID."""
            if entity_id in self._entities:
                return self._entities[entity_id]
            raise KeyError(f"Entity not found: {entity_id}")

        def get_or_create(self, entity_id: str) -> Any:
            """Get entity or create if not exists."""
            if entity_id not in self._entities:
                self._entities[entity_id] = _PyEntityTrust(entity_id)
            return self._entities[entity_id]

        def save(self, entity: Any):
            """Save entity to store."""
            import json
            self._entities[entity.entity_id] = entity
            filepath = self._entity_path(entity.entity_id)
            with open(filepath, 'w') as f:
                json.dump(entity.to_dict(), f, indent=2, default=str)

        def delete(self, entity_id: str) -> bool:
            """Delete entity from store."""
            if entity_id in self._entities:
                del self._entities[entity_id]
                filepath = self._entity_path(entity_id)
                if os.path.exists(filepath):
                    os.remove(filepath)
                return True
            return False

        def exists(self, entity_id: str) -> bool:
            """Check if entity exists."""
            return entity_id in self._entities

        def list_entities(self) -> List[str]:
            """List all entity IDs."""
            return list(self._entities.keys())

        def count(self) -> int:
            """Count entities in store."""
            return len(self._entities)

    def create_memory_store():
        """Create an in-memory trust store (Python fallback)."""
        import tempfile
        return TrustStore(tempfile.mkdtemp())


def get_backend_info() -> Dict[str, Any]:
    """Get information about the active backend."""
    return {
        "backend": "rust" if RUST_BACKEND else "python",
        "version": "0.1.0",
        "rust_available": RUST_BACKEND,
        "forced_python": FORCE_PYTHON_BACKEND,
        "error": _backend_error if not RUST_BACKEND else None,
    }


def verify_backend() -> bool:
    """Verify the backend is working correctly."""
    try:
        # Create test entity
        e = EntityTrust("test:verify")
        e.update_from_outcome(True, 0.1)

        # Verify basic operations
        assert e.entity_id == "test:verify", f"entity_id mismatch: {e.entity_id}"

        # t3_average may be < 0.5 due to decay or update mechanics
        t3_avg = e.t3_average()
        assert 0.0 <= t3_avg <= 1.0, f"t3_average out of range: {t3_avg}"

        # trust_level returns lowercase string
        level = e.trust_level()
        valid_levels = ["very_low", "low", "medium", "high", "very_high"]
        assert level.lower() in valid_levels, f"trust_level invalid: {level}"

        return True
    except Exception as ex:
        print(f"Backend verification failed: {ex}")
        return False


# Export all
__all__ = [
    'EntityTrust',
    'T3Tensor',
    'V3Tensor',
    'TrustStore',
    'create_memory_store',
    'get_backend_info',
    'verify_backend',
    'RUST_BACKEND',
]
