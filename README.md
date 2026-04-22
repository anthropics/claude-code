# Ethos Aegis — Agentic Immune Veriflow

[![Verification First](https://img.shields.io/badge/verification-first-275EFE?style=flat-square)](https://github.com/GoodshytGroup/Ethos-Aegis-Agentic-Immune-Veriflow)
[![CKAN Aware](https://img.shields.io/badge/ckan-aware-22D3EE?style=flat-square)](https://github.com/GoodshytGroup/Ethos-Aegis-Agentic-Immune-Veriflow)
[![Fingerprint Mode](https://img.shields.io/badge/fingerprint-auto-F5B700?style=flat-square)](https://github.com/GoodshytGroup/Ethos-Aegis-Agentic-Immune-Veriflow)
[![Python 3.9+](https://img.shields.io/badge/python-3.9%2B-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![CI](https://github.com/GoodshytGroup/Ethos-Aegis-Agentic-Immune-Veriflow/actions/workflows/python-package.yml/badge.svg)](https://github.com/GoodshytGroup/Ethos-Aegis-Agentic-Immune-Veriflow/actions/workflows/python-package.yml)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)

> **"Trust the verified path."**
>
> The Ethos Aegis is a living, adaptive digital immune architecture that maps every biological defense mechanism — from the flash-gate neutrophil to the memory vault of B-lymphocytes — into a rigorous computational framework for the purification of AI systems.

---

## 🧬 What Is This?

**Ethos Aegis** is a monorepo combining three interconnected systems:

| Component | Role |
|-----------|------|
| **Ethos Aegis** | Core immune architecture — defense-first, autonomic, schema-aware |
| **Veriflow** | CKAN-aware data ingestion and verification pipeline |
| **Claude Mythos** | Narrative + operational identity layer for the immune system |

The system is built around a **verification-first doctrine**: no conclusion is drawn without provenance, no data is trusted without fingerprinting, and no capability is assumed without probing.

---

## 🚀 Quick Start

### Python (Ethos Aegis / Veriflow)

```bash
# Install dependencies
pip install -r requirements.txt

# Run the test suite
pytest tests/ -q

# Run linting
flake8 ethos_aegis/ tests/
```

### TypeScript (Cloudflare Worker)

```bash
# Install dependencies
npm install

# Type-check
npm run typecheck

# Local dev
npm run worker:dev
```

### Using Make

```bash
make help          # Show all commands
make test          # Run all tests
make lint          # Run all linters
make install       # Install all dependencies
```

---

## 🏗️ Architecture

```
ethos_aegis/
├── mythos_runtime/        # Claude Mythos operating layer
│   ├── budget.py          # Token/turn budget metering
│   ├── drift.py           # File drift detection
│   ├── memory.py          # Memory ledger (MEMORY.md)
│   └── swd.py             # Strict Write Discipline verification
└── veriflow/
    ├── ckan_adapter.py    # CKAN host fingerprinting + ingestion
    └── immune_system.py   # VeriflowImmuneSystem orchestration

src/
└── index.ts               # Cloudflare Worker entrypoint

tests/
├── test_mythos_runtime.py
└── test_mythos_brand_contract.py
```

---

## 🛡️ Core Principles

- **Defense-first** — never exploit-first
- **Verification before conclusion** — every dataset is fingerprinted
- **Provenance before confidence** — ingestion path is always logged
- **Autonomic monitoring** — before manual prompting
- **Schema-aware reasoning** — graceful fallback when schema unavailable

---

## 📋 Runtime Doctrine (Claude Mythos)

1. Probe the host
2. Cache capabilities
3. Select the best ingestion path
4. Verify normalized rows
5. Generate candidate laws and formulas
6. Score by fit, semantics, coverage, stability, and complexity
7. Return the answer with host profile, evidence, and ingestion provenance

---

## 🔌 Integration

```python
from ethos_aegis.veriflow import CKANClient, VeriflowImmuneSystem

ckan = CKANClient("https://your-ckan-host")
immune = VeriflowImmuneSystem(
    ckan,
    probe_on_startup=True,
    fingerprint_mode="auto",
)
```

---

## 📦 Project Structure

```
.
├── ethos_aegis/           # Python: core immune system
├── src/                   # TypeScript: Cloudflare Worker
├── tests/                 # Python test suite
├── docs/                  # Documentation
├── scripts/               # Utility scripts
├── plugins/               # Claude Code plugins
├── schemas/               # JSON/YAML schemas
└── veriflow-Sovereign-Lattice/  # Veriflow sovereign lattice module
```

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

---

## 📄 License

MIT — see [LICENSE](./LICENSE).

---

## 🔗 Related

- [CLAUDE_MYTHOS.md](./CLAUDE_MYTHOS.md) — Operating contract for the Claude Mythos identity layer
- [CHANGELOG.md](./CHANGELOG.md) — Release history
- [SECURITY.md](./SECURITY.md) — Security policy

