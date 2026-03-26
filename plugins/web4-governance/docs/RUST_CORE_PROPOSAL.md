# Web4 Trust Core - Rust Implementation Proposal

**Date:** 2025-01-24
**Status:** Proposed
**Author:** Claude (with dp)

## Summary

Implement the core Web4 trust primitives in Rust as a portable library (`web4-trust-core`) that can be used from Python, JavaScript/TypeScript, and native applications via FFI bindings.

## Motivation

The current Python implementation works well for prototyping but has limitations:

1. **Performance** - Trust calculations in hot paths (every tool call) add latency
2. **Portability** - Python can't run in browsers, edge devices, or embedded systems
3. **Safety** - Trust is security-critical; memory safety and type safety matter
4. **Consistency** - Multiple implementations risk divergence; one core ensures uniformity

Web4 trust primitives are foundational infrastructure. They should be:
- Fast (sub-millisecond operations)
- Portable (run anywhere)
- Safe (no undefined behavior)
- Verifiable (deterministic, reproducible)

## Architecture

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Applications                              │
│  Claude Code │ Web Validators │ Mobile Apps │ IoT Devices   │
└──────────────┬───────────────┬─────────────┬────────────────┘
               │               │             │
┌──────────────┴───┐ ┌────────┴────────┐ ┌──┴──────────────┐
│  Python Bindings │ │  WASM Bindings  │ │  C FFI / Native │
│  (PyO3)          │ │  (wasm-bindgen) │ │                 │
└──────────────────┘ └─────────────────┘ └─────────────────┘
               │               │             │
┌──────────────┴───────────────┴─────────────┴────────────────┐
│                    web4-trust-core                           │
│                         (Rust)                               │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ T3 Tensor   │ │ V3 Tensor   │ │ Witnessing  │            │
│  │ Operations  │ │ Operations  │ │ Chains      │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ Entity      │ │ Role        │ │ Decay       │            │
│  │ Trust       │ │ Trust       │ │ Functions   │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ LCT         │ │ Storage     │ │ Serialtic   │            │
│  │ Primitives  │ │ Backend     │ │ (serde)     │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### Core Types

```rust
/// T3 Trust Tensor - 6 dimensions
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct T3Tensor {
    pub competence: f64,   // Can they do it?
    pub reliability: f64,  // Will they do it consistently?
    pub consistency: f64,  // Same quality over time?
    pub witnesses: f64,    // Corroborated by others?
    pub lineage: f64,      // Track record length?
    pub alignment: f64,    // Values match context?
}

/// V3 Value Tensor - 6 dimensions
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct V3Tensor {
    pub energy: f64,       // Effort/resources invested
    pub contribution: f64, // Value added to ecosystem
    pub stewardship: f64,  // Care for shared resources
    pub network: f64,      // Connections / reach
    pub reputation: f64,   // External perception
    pub temporal: f64,     // Time-based value accumulation
}

/// Entity trust combining T3 and V3
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EntityTrust {
    pub entity_id: String,
    pub entity_type: EntityType,
    pub t3: T3Tensor,
    pub v3: V3Tensor,
    pub witnessed_by: Vec<String>,
    pub has_witnessed: Vec<String>,
    pub action_count: u64,
    pub success_count: u64,
    pub last_action: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Entity types in the Web4 ecosystem
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum EntityType {
    Mcp(String),      // MCP server
    Role(String),     // Agent role
    Session(String),  // Session identity
    Reference(String),// Reference/context
    Lct(String),      // Linked Context Token
}
```

### Core Operations

```rust
impl T3Tensor {
    /// Average trust score (0.0 - 1.0)
    pub fn average(&self) -> f64;

    /// Categorical trust level
    pub fn level(&self) -> TrustLevel;

    /// Update from outcome (success/failure)
    pub fn update_from_outcome(&mut self, success: bool, magnitude: f64);

    /// Apply temporal decay
    pub fn apply_decay(&mut self, days_inactive: f64, decay_rate: f64);
}

impl EntityTrust {
    /// Receive a witness event (another entity observed this one)
    pub fn receive_witness(&mut self, witness_id: &str, success: bool, magnitude: f64);

    /// Give a witness event (this entity observed another)
    pub fn give_witness(&mut self, target_id: &str, success: bool, magnitude: f64);

    /// Calculate days since last action
    pub fn days_since_last_action(&self) -> f64;
}

/// Witnessing chain operations
pub struct WitnessingChain {
    pub fn trace_witnesses(&self, entity_id: &str, depth: u32) -> Vec<WitnessNode>;
    pub fn trace_witnessed(&self, entity_id: &str, depth: u32) -> Vec<WitnessNode>;
    pub fn calculate_transitive_trust(&self, entity_id: &str) -> f64;
}
```

### Storage Backend

```rust
pub trait TrustStore {
    fn get(&self, entity_id: &str) -> Result<EntityTrust>;
    fn save(&self, trust: &EntityTrust) -> Result<()>;
    fn list(&self, entity_type: Option<EntityType>) -> Result<Vec<String>>;
    fn witness(&self, witness_id: &str, target_id: &str, success: bool) -> Result<(EntityTrust, EntityTrust)>;
}

// Implementations:
// - InMemoryStore (for testing, WASM)
// - SledStore (embedded, fast)
// - FileStore (JSON files, compatible with Python impl)
```

## Binding Strategy

### Python (PyO3)

```python
# Usage from Python
from web4_trust import EntityTrust, TrustStore

store = TrustStore.open("~/.web4/governance/entities")
trust = store.get("mcp:filesystem")
print(f"T3 average: {trust.t3_average()}")

# Witness an event
store.witness("session:abc", "mcp:filesystem", success=True)
```

### JavaScript/TypeScript (wasm-bindgen)

```typescript
// Usage from TypeScript
import { EntityTrust, TrustStore } from 'web4-trust';

const store = new TrustStore();
const trust = store.get("mcp:filesystem");
console.log(`T3 average: ${trust.t3Average()}`);

// Witness an event
store.witness("session:abc", "mcp:filesystem", true);
```

### C FFI

```c
// Usage from C
#include "web4_trust.h"

web4_trust_store_t* store = web4_trust_store_open("~/.web4/governance/entities");
web4_entity_trust_t* trust = web4_trust_store_get(store, "mcp:filesystem");
double t3_avg = web4_entity_trust_t3_average(trust);

web4_trust_store_witness(store, "session:abc", "mcp:filesystem", true);
```

## Migration Path

### Phase 1: Core Library (Week 1)
- [ ] Scaffold `web4-trust-core` crate
- [ ] Implement T3Tensor, V3Tensor, EntityTrust
- [ ] Implement core operations (update, decay, witness)
- [ ] Unit tests for all operations
- [ ] FileStore backend (JSON compatible with Python)

### Phase 2: Python Bindings (Week 2)
- [ ] Add PyO3 feature flag
- [ ] Implement Python module
- [ ] Test compatibility with existing Python code
- [ ] Gradual migration of claude-code-plugin hooks

### Phase 3: WASM Bindings (Week 3)
- [ ] Add wasm-bindgen feature flag
- [ ] Implement JS/TS bindings
- [ ] Test in browser environment
- [ ] npm package publishing

### Phase 4: Advanced Features (Week 4+)
- [ ] LCT primitives (signing, verification)
- [ ] Sled storage backend
- [ ] Transitive trust calculations
- [ ] MRH boundary enforcement

## File Structure

```
web4-trust-core/
├── Cargo.toml
├── src/
│   ├── lib.rs              # Public API
│   ├── tensor/
│   │   ├── mod.rs
│   │   ├── t3.rs           # T3 Trust Tensor
│   │   └── v3.rs           # V3 Value Tensor
│   ├── entity/
│   │   ├── mod.rs
│   │   ├── trust.rs        # EntityTrust
│   │   └── types.rs        # EntityType enum
│   ├── witnessing/
│   │   ├── mod.rs
│   │   ├── chain.rs        # WitnessingChain
│   │   └── event.rs        # WitnessEvent
│   ├── decay/
│   │   ├── mod.rs
│   │   └── temporal.rs     # Decay functions
│   ├── storage/
│   │   ├── mod.rs
│   │   ├── traits.rs       # TrustStore trait
│   │   ├── memory.rs       # InMemoryStore
│   │   ├── file.rs         # FileStore (JSON)
│   │   └── sled.rs         # SledStore (optional)
│   └── bindings/
│       ├── mod.rs
│       ├── python.rs       # PyO3 bindings
│       └── wasm.rs         # wasm-bindgen bindings
├── tests/
│   ├── tensor_tests.rs
│   ├── entity_tests.rs
│   ├── witnessing_tests.rs
│   └── storage_tests.rs
└── benches/
    └── trust_benchmarks.rs
```

## Cargo.toml Features

```toml
[package]
name = "web4-trust-core"
version = "0.1.0"
edition = "2021"

[features]
default = ["file-store"]
file-store = ["serde_json"]
sled-store = ["sled"]
python = ["pyo3"]
wasm = ["wasm-bindgen", "js-sys"]

[dependencies]
serde = { version = "1.0", features = ["derive"] }
chrono = { version = "0.4", features = ["serde"] }
thiserror = "1.0"

# Optional dependencies
serde_json = { version = "1.0", optional = true }
sled = { version = "0.34", optional = true }
pyo3 = { version = "0.20", features = ["extension-module"], optional = true }
wasm-bindgen = { version = "0.2", optional = true }
js-sys = { version = "0.3", optional = true }
```

## Success Criteria

1. **Correctness**: All Python tests pass with Rust backend
2. **Performance**: Trust operations < 100μs (currently ~1ms in Python)
3. **Compatibility**: JSON files readable by both Python and Rust
4. **Portability**: WASM build works in browser
5. **Safety**: No unsafe code outside FFI boundaries

## Open Questions

1. **Storage format**: Keep JSON for compatibility, or use binary (MessagePack, bincode)?
2. **Async**: Should storage operations be async-first?
3. **Versioning**: How to handle schema evolution in stored trust data?
4. **Caching**: Should the Rust layer cache entities in memory?

## References

- [PyO3 User Guide](https://pyo3.rs/)
- [wasm-bindgen Guide](https://rustwasm.github.io/wasm-bindgen/)
- [sled embedded database](https://sled.rs/)
- [Web4 Whitepaper](../../whitepaper/)
